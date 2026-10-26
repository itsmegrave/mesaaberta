import { and, asc, desc, eq, gt, inArray, lte, or, type SQL } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { unfollowBothWays } from '../follows/service';
import {
  gameTables,
  gmInviteBlocks,
  playerInvitations,
  profiles,
  registrations,
} from '../db/schema';
import type { Actor } from '../auth/policy';
import { Forbidden, Invalid, NotFound, TableFull } from '../errors';
import { recordEvent } from '../events/outbox';
import { addTableMember } from '../messages/service';
import { enforceRateLimit } from '../rate-limit';
import { seatAvailability } from './seats';

export type InvitationStatus = typeof playerInvitations.$inferSelect.status;
type Invitation = typeof playerInvitations.$inferSelect;
type Table = typeof gameTables.$inferSelect;
const unavailable = () => new Invalid('invitation', 'unavailable');
function signed(actor: Actor | null): asserts actor is Actor {
  if (!actor || actor.status !== 'active') throw new Forbidden();
}

/**
 * Eligibility writers serialize profile status/preferences before table locks. NO KEY UPDATE also
 * lets an in-flight registration check its profile foreign key while we wait for its table row.
 */
export async function lockInvitationProfiles(db: AnyDb, ids: string[]) {
  return db
    .select()
    .from(profiles)
    .where(inArray(profiles.id, [...new Set(ids)].sort()))
    .orderBy(asc(profiles.id))
    .for('no key update');
}
const record = (
  db: AnyDb,
  i: Invitation,
  slug: string,
  type:
    | 'PlayerInvited'
    | 'InvitationAccepted'
    | 'InvitationDeclined'
    | 'InvitationExpired'
    | 'InvitationCancelled',
  actorId: string | null,
  now: Date,
) =>
  recordEvent(
    db,
    {
      type,
      actorId,
      payload: { tableId: i.tableId, slug, gmId: i.gmId, playerId: i.playerId, invitationId: i.id },
    },
    { now },
  );
async function finish(
  db: AnyDb,
  i: Invitation,
  t: Pick<Table, 'slug'>,
  status: Exclude<InvitationStatus, 'pending'>,
  actorId: string | null,
  now: Date,
  reason: string | null = null,
) {
  const [updated] = await db
    .update(playerInvitations)
    .set({ status, respondedAt: now, cancellationReason: reason })
    .where(and(eq(playerInvitations.id, i.id), eq(playerInvitations.status, 'pending')))
    .returning();
  if (!updated) return [];
  const type = {
    accepted: 'InvitationAccepted',
    declined: 'InvitationDeclined',
    expired: 'InvitationExpired',
    cancelled: 'InvitationCancelled',
  } as const;
  return [await record(db, i, t.slug, type[status], actorId, now)];
}
async function canReceive(db: AnyDb, gmId: string, playerId: string) {
  const [p] = await db.select().from(profiles).where(eq(profiles.id, playerId));
  const [gm] = await db.select().from(profiles).where(eq(profiles.id, gmId));
  const [block] = await db
    .select()
    .from(gmInviteBlocks)
    .where(and(eq(gmInviteBlocks.playerId, playerId), eq(gmInviteBlocks.gmId, gmId)));
  return !!(
    p?.status === 'active' &&
    p.username &&
    p.invitationsEnabled &&
    gm?.status === 'active' &&
    gm.username &&
    !block
  );
}

export async function inviteUsername(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  username: string,
  options: { now?: Date } = {},
) {
  signed(actor);
  const [p] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.username, username.trim().replace(/^@/, '').toLowerCase()));
  if (!p) throw unavailable();
  return invitePlayer(db, actor, slug, p.id, options);
}

export async function invitePlayer(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  playerId: string,
  { now = new Date() }: { now?: Date } = {},
) {
  signed(actor);
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    await lockInvitationProfiles(t, [actor.id, playerId]);
    const [table] = await t
      .select()
      .from(gameTables)
      .where(eq(gameTables.slug, slug))
      .for('update');
    if (!table) throw new NotFound();
    if (table.gmId !== actor.id) throw new Forbidden();
    if (
      playerId === actor.id ||
      table.status !== 'active' ||
      table.startsAt <= now ||
      !(await canReceive(t, actor.id, playerId))
    )
      throw unavailable();
    const previous = await t
      .select()
      .from(playerInvitations)
      .where(
        and(eq(playerInvitations.tableId, table.id), eq(playerInvitations.playerId, playerId)),
      );
    if (previous.some((i) => i.status === 'declined')) throw unavailable();
    const eventIds: string[] = [];
    for (const i of previous.filter((i) => i.status === 'pending')) {
      if (i.expiresAt > now) throw unavailable();
      eventIds.push(...(await finish(t, i, table, 'expired', null, now)));
    }
    const [registration] = await t
      .select()
      .from(registrations)
      .where(and(eq(registrations.tableId, table.id), eq(registrations.playerId, playerId)));
    if (registration) throw unavailable();
    if ((await seatAvailability(t, table.id, now)).available < 1) throw new TableFull();
    await enforceRateLimit(
      t,
      actor.id,
      { events: ['PlayerInvited'], max: 5, windowSeconds: 60 },
      now,
    );
    await enforceRateLimit(
      t,
      actor.id,
      { events: ['PlayerInvited'], max: 20, windowSeconds: 86400 },
      now,
    );
    const [i] = await t
      .insert(playerInvitations)
      .values({
        tableId: table.id,
        gmId: actor.id,
        playerId,
        createdAt: now,
        expiresAt: new Date(Math.min(now.getTime() + 48 * 3600000, table.startsAt.getTime())),
      })
      .returning();
    eventIds.push(await record(t, i, slug, 'PlayerInvited', actor.id, now));
    return { invitationId: i.id, eventIds };
  });
}

async function withInvitation<T>(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  role: 'player' | 'gm',
  apply: (db: AnyDb, i: Invitation, table: Table) => Promise<T>,
) {
  signed(actor);
  const [initial] = await db.select().from(playerInvitations).where(eq(playerInvitations.id, id));
  if (!initial || (role === 'player' ? initial.playerId : initial.gmId) !== actor.id)
    throw new NotFound();
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    await lockInvitationProfiles(t, [initial.gmId, initial.playerId]);
    const [table] = await t
      .select()
      .from(gameTables)
      .where(eq(gameTables.id, initial.tableId))
      .for('update');
    const [i] = await t.select().from(playerInvitations).where(eq(playerInvitations.id, id));
    if (!i || !table) throw new NotFound();
    return apply(t, i, table);
  });
}
export async function respondToInvitation(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  decision: 'accept' | 'decline',
  { now = new Date() }: { now?: Date } = {},
) {
  return withInvitation(db, actor, id, 'player', async (t, i, table) => {
    if (i.status !== 'pending') return { status: i.status, eventIds: [] as string[] };
    if (i.expiresAt <= now || table.startsAt <= now)
      return {
        status: 'expired' as const,
        eventIds: await finish(t, i, table, 'expired', null, now),
      };
    if (table.status !== 'active' || !(await canReceive(t, i.gmId, i.playerId)))
      return {
        status: 'cancelled' as const,
        eventIds: await finish(t, i, table, 'cancelled', null, now, 'unavailable'),
      };
    if (decision === 'decline')
      return {
        status: 'declined' as const,
        eventIds: await finish(t, i, table, 'declined', actor!.id, now),
      };
    const [existing] = await t
      .select()
      .from(registrations)
      .where(and(eq(registrations.tableId, i.tableId), eq(registrations.playerId, i.playerId)));
    if (existing)
      return {
        status: 'cancelled' as const,
        eventIds: await finish(t, i, table, 'cancelled', null, now, 'registered'),
      };
    // The reservation already owns this seat. Exchange it, without asking for an additional seat.
    await t
      .insert(registrations)
      .values({ tableId: i.tableId, playerId: i.playerId, status: 'confirmed' });
    await addTableMember(t, i.tableId, i.playerId);
    const eventIds = await finish(t, i, table, 'accepted', actor!.id, now);
    eventIds.push(
      await recordEvent(
        t,
        {
          type: 'PlayerJoined',
          actorId: actor!.id,
          payload: { tableId: i.tableId, slug: table.slug, playerId: i.playerId },
        },
        { now },
      ),
    );
    return { status: 'accepted' as const, eventIds };
  });
}
export async function cancelInvitation(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  { now = new Date() }: { now?: Date } = {},
) {
  return withInvitation(db, actor, id, 'gm', async (t, i, table) => ({
    status: i.status === 'pending' ? ('cancelled' as const) : i.status,
    eventIds:
      i.status === 'pending' ? await finish(t, i, table, 'cancelled', actor!.id, now, 'gm') : [],
  }));
}

/** Caller holds the affected profile lock, then takes table locks in deterministic order. */
export async function cancelPendingInvitations(
  db: AnyDb,
  where: SQL,
  reason: string,
  now = new Date(),
  actorId: string | null = null,
) {
  const candidates = await db
    .select()
    .from(playerInvitations)
    .where(and(eq(playerInvitations.status, 'pending'), where))
    .orderBy(asc(playerInvitations.tableId), asc(playerInvitations.id));
  const ids = [...new Set(candidates.map((i) => i.tableId))].sort();
  const eventIds: string[] = [];
  for (const tableId of ids) {
    const [table] = await db
      .select()
      .from(gameTables)
      .where(eq(gameTables.id, tableId))
      .for('update');
    if (!table) continue;
    for (const i of candidates.filter((i) => i.tableId === tableId))
      eventIds.push(...(await finish(db, i, table, 'cancelled', actorId, now, reason)));
  }
  return eventIds;
}
export async function setInvitationsEnabled(
  db: AnyDb,
  actor: Actor | null,
  enabled: boolean,
  { now = new Date() }: { now?: Date } = {},
) {
  signed(actor);
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    await lockInvitationProfiles(t, [actor.id]);
    await t.update(profiles).set({ invitationsEnabled: enabled }).where(eq(profiles.id, actor.id));
    return {
      eventIds: enabled
        ? []
        : await cancelPendingInvitations(
            t,
            eq(playerInvitations.playerId, actor.id),
            'opt_out',
            now,
            actor.id,
          ),
    };
  });
}
export async function setGmInviteBlock(
  db: AnyDb,
  actor: Actor | null,
  gmId: string,
  blocked: boolean,
  { now = new Date() }: { now?: Date } = {},
) {
  signed(actor);
  if (gmId === actor.id) throw unavailable();
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const found = await lockInvitationProfiles(t, [actor.id, gmId]);
    if (!found.some((p) => p.id === gmId)) throw new NotFound();
    if (blocked) {
      await t
        .insert(gmInviteBlocks)
        .values({ playerId: actor.id, gmId, createdAt: now })
        .onConflictDoNothing();
      // A block also undoes following, both ways (`follow:create` refuses a new one).
      await unfollowBothWays(t, actor.id, gmId);
    } else
      await t
        .delete(gmInviteBlocks)
        .where(and(eq(gmInviteBlocks.playerId, actor.id), eq(gmInviteBlocks.gmId, gmId)));
    return {
      eventIds: blocked
        ? await cancelPendingInvitations(
            t,
            and(eq(playerInvitations.playerId, actor.id), eq(playerInvitations.gmId, gmId))!,
            'blocked',
            now,
            actor.id,
          )
        : [],
    };
  });
}
export async function invitationPreferences(db: AnyDb, actor: Actor | null) {
  signed(actor);
  const [p] = await db
    .select({ enabled: profiles.invitationsEnabled })
    .from(profiles)
    .where(eq(profiles.id, actor.id));
  const blocks = await db
    .select({ gmId: gmInviteBlocks.gmId, username: profiles.username })
    .from(gmInviteBlocks)
    .innerJoin(profiles, eq(profiles.id, gmInviteBlocks.gmId))
    .where(eq(gmInviteBlocks.playerId, actor.id));
  return { enabled: p?.enabled ?? true, blocks };
}
export async function expireInvitations(
  db: AnyDb,
  { now = new Date(), limit = 100 }: { now?: Date; limit?: number } = {},
) {
  const candidates = await db
    .select()
    .from(playerInvitations)
    .where(and(eq(playerInvitations.status, 'pending'), lte(playerInvitations.expiresAt, now)))
    .orderBy(asc(playerInvitations.expiresAt), asc(playerInvitations.id))
    .limit(limit);
  const eventIds: string[] = [];
  let processed = 0;
  for (const i of candidates)
    await db.transaction(async (tx) => {
      const t = tx as unknown as AnyDb;
      await lockInvitationProfiles(t, [i.gmId, i.playerId]);
      const [table] = await t
        .select()
        .from(gameTables)
        .where(eq(gameTables.id, i.tableId))
        .for('update');
      if (!table) return;
      const emitted = await finish(t, i, table, 'expired', null, now);
      if (emitted.length) processed++;
      eventIds.push(...emitted);
    });
  return { eventIds, processed };
}
const invitationView = {
  id: playerInvitations.id,
  status: playerInvitations.status,
  expiresAt: playerInvitations.expiresAt,
  createdAt: playerInvitations.createdAt,
  gmId: playerInvitations.gmId,
  table: {
    title: gameTables.title,
    slug: gameTables.slug,
    kind: gameTables.kind,
    startsAt: gameTables.startsAt,
    timezone: gameTables.timezone,
  },
  gmUsername: profiles.username,
};
export async function loadInvitation(db: AnyDb, actor: Actor | null, id: string) {
  signed(actor);
  const [i] = await db
    .select(invitationView)
    .from(playerInvitations)
    .innerJoin(gameTables, eq(gameTables.id, playerInvitations.tableId))
    .innerJoin(profiles, eq(profiles.id, playerInvitations.gmId))
    .where(and(eq(playerInvitations.id, id), eq(playerInvitations.playerId, actor.id)));
  if (!i) throw new NotFound();
  return i;
}
export async function listReceivedInvitations(db: AnyDb, actor: Actor | null) {
  signed(actor);
  return db
    .select(invitationView)
    .from(playerInvitations)
    .innerJoin(gameTables, eq(gameTables.id, playerInvitations.tableId))
    .innerJoin(profiles, eq(profiles.id, playerInvitations.gmId))
    .where(eq(playerInvitations.playerId, actor.id))
    .orderBy(desc(playerInvitations.createdAt))
    .limit(100);
}
export async function listTableInvitations(db: AnyDb, actor: Actor | null, slug: string) {
  signed(actor);
  const [table] = await db.select().from(gameTables).where(eq(gameTables.slug, slug));
  if (!table || table.gmId !== actor.id) throw new NotFound();
  return db
    .select({
      id: playerInvitations.id,
      playerId: playerInvitations.playerId,
      username: profiles.username,
      status: playerInvitations.status,
      expiresAt: playerInvitations.expiresAt,
      createdAt: playerInvitations.createdAt,
    })
    .from(playerInvitations)
    .innerJoin(profiles, eq(profiles.id, playerInvitations.playerId))
    .where(eq(playerInvitations.tableId, table.id))
    .orderBy(desc(playerInvitations.createdAt));
}
export async function pendingInvitationFor(
  db: AnyDb,
  tableId: string,
  playerId: string,
  { now = new Date() }: { now?: Date } = {},
) {
  const [i] = await db
    .select({ id: playerInvitations.id })
    .from(playerInvitations)
    .where(
      and(
        eq(playerInvitations.tableId, tableId),
        eq(playerInvitations.playerId, playerId),
        eq(playerInvitations.status, 'pending'),
        gt(playerInvitations.expiresAt, now),
      ),
    );
  return i ?? null;
}

/** Moderation/deletion also update owned tables and seats: acquire their union before mutation. */
export async function lockInvitationTablesForProfile(db: AnyDb, profileId: string) {
  return db
    .select({ id: gameTables.id })
    .from(gameTables)
    .where(
      or(
        eq(gameTables.gmId, profileId),
        inArray(
          gameTables.id,
          db
            .select({ tableId: playerInvitations.tableId })
            .from(playerInvitations)
            .where(
              or(eq(playerInvitations.gmId, profileId), eq(playerInvitations.playerId, profileId)),
            ),
        ),
        inArray(
          gameTables.id,
          db
            .select({ tableId: registrations.tableId })
            .from(registrations)
            .where(eq(registrations.playerId, profileId)),
        ),
      ),
    )
    .orderBy(asc(gameTables.id))
    .for('update');
}
