import { and, asc, count, eq, lt, or, sql } from 'drizzle-orm';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import {
  gameTables,
  profiles,
  registrations,
  tableWaitlist,
} from '@mesaaberta/core/server/db/schema';
import { publicName } from '@mesaaberta/core/server/db/public-name';
import { authorize, joinBlocker, type Actor } from '@mesaaberta/core/server/auth/policy';
import { AlreadyRegistered, Forbidden, NotFound } from '@mesaaberta/core/server/errors';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';
import { hasStarted } from '@mesaaberta/core/server/tables/schedule';
import { Invalid } from '../errors';
import { seatAvailability } from '../invitations/seats';
import { pendingInvitationFor } from '../invitations/service';
import { addTableMember } from '../messages/service';

// The lista de espera of a full table (`use_waitlist`, checked by the web Worker). Joining it is only
// possible while the table has no seat left; when one frees up (a player leaves or is removed, or
// the GM adds seats) `promoteWaitlist` runs in that same transaction, under the table lock, so the
// seat goes to the first in line and never to two people.

type Table = typeof gameTables.$inferSelect;

/** The table row, locked until the transaction ends (the lock `joinTable` takes too). */
async function lockTable(db: AnyDb, slug: string) {
  const [table] = await db.select().from(gameTables).where(eq(gameTables.slug, slug)).for('update');
  if (!table) throw new NotFound(`no table with slug "${slug}"`);
  return table;
}

/**
 * The signed-in player gets in line at a full table. Refused like a join for anything but the full
 * table (`joinBlocker`): a table that opened a seat meanwhile answers `seats_left`, so the page offers
 * the seat itself.
 */
export async function joinWaitlist(db: AnyDb, actor: Actor | null, slug: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const table = await lockTable(t, slug);
    const [registered] = actor
      ? await t
          .select({ one: sql`1` })
          .from(registrations)
          .where(and(eq(registrations.tableId, table.id), eq(registrations.playerId, actor.id)))
      : [];
    if (actor && (await pendingInvitationFor(t, table.id, actor.id, { now })))
      throw new Invalid('invitation', 'decision_required');
    const blocker = joinBlocker(actor, {
      gmId: table.gmId,
      tableStatus: table.status,
      started: hasStarted(table.startsAt, now),
      seatsLeft: (await seatAvailability(t, table.id, now)).available,
      alreadyRegistered: registered !== undefined,
    });
    if (blocker === 'inactive') throw new NotFound('the table is not active');
    if (blocker === 'registered') throw new AlreadyRegistered();
    if (blocker === null) throw new Invalid('waitlist', 'seats_left');
    if (blocker !== 'full') throw new Forbidden('table:join');

    await t
      .insert(tableWaitlist)
      .values({ tableId: table.id, playerId: actor!.id, createdAt: now })
      .onConflictDoNothing();
    return { eventIds: [] as string[] };
  });
}

/** The player leaves the line. Nothing to do when they were not in it. */
export async function leaveWaitlist(db: AnyDb, actor: Actor | null, slug: string) {
  if (!actor) throw new Forbidden('table:join');
  const [table] = await db
    .select({ id: gameTables.id })
    .from(gameTables)
    .where(eq(gameTables.slug, slug));
  if (!table) throw new NotFound(`no table with slug "${slug}"`);
  await db
    .delete(tableWaitlist)
    .where(and(eq(tableWaitlist.tableId, table.id), eq(tableWaitlist.playerId, actor.id)));
  return { eventIds: [] as string[] };
}

/**
 * Moves the line up while the table has room, in the caller's transaction, which must hold the
 * table's row lock. At a table that seats people directly the first in line gets the seat; at one
 * that approves each player their request goes to the GM, and the line moves on only while there are
 * more free seats than open requests. Whoever cannot join any more (a suspended account, someone
 * already at the table) just leaves the line. Answers the events to dispatch.
 */
export async function promoteWaitlist(db: AnyDb, table: Table, now = new Date()) {
  const eventIds: string[] = [];
  if (table.status !== 'active' || hasStarted(table.startsAt, now)) return eventIds;

  for (;;) {
    const { available } = await seatAvailability(db, table.id, now);
    const [{ pending }] = await db
      .select({ pending: count() })
      .from(registrations)
      .where(and(eq(registrations.tableId, table.id), eq(registrations.status, 'pending')));
    const room = table.joinMode === 'auto' ? available : available - pending;
    if (room <= 0) return eventIds;

    const [next] = await db
      .select({
        playerId: tableWaitlist.playerId,
        status: profiles.status,
        registered: sql<boolean>`exists (select 1 from ${registrations} where ${registrations.tableId} = ${table.id} and ${registrations.playerId} = ${tableWaitlist.playerId})`,
      })
      .from(tableWaitlist)
      .innerJoin(profiles, eq(profiles.id, tableWaitlist.playerId))
      .where(eq(tableWaitlist.tableId, table.id))
      .orderBy(asc(tableWaitlist.createdAt), asc(tableWaitlist.playerId))
      .limit(1);
    if (!next) return eventIds;

    await db
      .delete(tableWaitlist)
      .where(and(eq(tableWaitlist.tableId, table.id), eq(tableWaitlist.playerId, next.playerId)));
    if (next.status !== 'active' || next.registered) continue;

    const status = table.joinMode === 'auto' ? 'confirmed' : 'pending';
    await db.insert(registrations).values({ tableId: table.id, playerId: next.playerId, status });
    if (status === 'confirmed') await addTableMember(db, table.id, next.playerId);
    eventIds.push(
      await recordEvent(
        db,
        {
          type: status === 'confirmed' ? 'PlayerJoined' : 'JoinRequested',
          actorId: next.playerId,
          payload: {
            tableId: table.id,
            slug: table.slug,
            playerId: next.playerId,
            fromWaitlist: true,
          },
        },
        { now },
      ),
    );
  }
}

/** Locks the table by id and moves its line up: for the writes that free a seat without the lock. */
export async function promoteWaitlistOf(db: AnyDb, tableId: string, now = new Date()) {
  const [table] = await db
    .select()
    .from(gameTables)
    .where(eq(gameTables.id, tableId))
    .for('update');
  return table ? promoteWaitlist(db, table, now) : [];
}

/**
 * The viewer's place in line (1 is next), and how many wait: null when they are not in it. The
 * size is shown to everyone on a full table, so it is a count only.
 */
export async function waitlistOf(db: AnyDb, tableId: string, playerId: string | null) {
  const [{ size }] = await db
    .select({ size: count() })
    .from(tableWaitlist)
    .where(eq(tableWaitlist.tableId, tableId));
  if (!playerId) return { size, position: null };
  const [mine] = await db
    .select({ createdAt: tableWaitlist.createdAt })
    .from(tableWaitlist)
    .where(and(eq(tableWaitlist.tableId, tableId), eq(tableWaitlist.playerId, playerId)));
  if (!mine) return { size, position: null };
  const [{ ahead }] = await db
    .select({ ahead: count() })
    .from(tableWaitlist)
    .where(
      and(
        eq(tableWaitlist.tableId, tableId),
        or(
          lt(tableWaitlist.createdAt, mine.createdAt),
          and(eq(tableWaitlist.createdAt, mine.createdAt), lt(tableWaitlist.playerId, playerId)),
        ),
      ),
    );
  return { size, position: ahead + 1 };
}

/** The line in order, with names: only for the GM and admins, like the registrations. */
export async function listWaitlist(
  db: AnyDb,
  actor: Actor | null,
  table: { id: string; gmId: string },
) {
  authorize(actor, 'registration:manage', table);
  return db
    .select({
      playerId: tableWaitlist.playerId,
      username: publicName(profiles.username),
      avatarUrl: profiles.avatarUrl,
      avatarPath: profiles.avatarPath,
    })
    .from(tableWaitlist)
    .innerJoin(profiles, eq(profiles.id, tableWaitlist.playerId))
    .where(eq(tableWaitlist.tableId, table.id))
    .orderBy(asc(tableWaitlist.createdAt), asc(tableWaitlist.playerId));
}
