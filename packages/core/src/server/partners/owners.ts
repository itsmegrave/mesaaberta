import { and, asc, eq, gt, inArray, sql, type AnyColumn } from 'drizzle-orm';
import { MAX_PARTNER_OWNERS, PARTNER_INVITATION_DAYS } from '../../partners/owners';
import { authorize, type Actor } from '@mesaaberta/core/server/auth/policy';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { publicName } from '@mesaaberta/core/server/db/public-name';
import { textArray } from '@mesaaberta/core/server/db/text-array';
import {
  partnerInvitations,
  partnerOwners,
  partners,
  profiles,
} from '@mesaaberta/core/server/db/schema';
import { Forbidden, Invalid, NotFound } from '@mesaaberta/core/server/errors';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';
import { enforceRateLimit } from '@mesaaberta/core/server/rate-limit';

// Who looks after a partner (`partner_owners`) and the invitations that add an account to it. Every
// owner may edit the partner, invite, cancel an invite, take another account off and leave, except
// the last one, who withdraws the partner instead. An invite counts against MAX_PARTNER_OWNERS
// while it waits, so the list never ends up past the limit. Whoever is refused an invite hears the
// same `unavailable`, whether the account does not exist, cannot receive it or is already there.

type Partner = typeof partners.$inferSelect;
type Invitation = typeof partnerInvitations.$inferSelect;
type Ending = 'accepted' | 'declined' | 'cancelled' | 'expired';

const DAY = 86_400_000;
const unavailable = () => new Invalid('username', 'unavailable');

/**
 * The owners' ids as an SQL array, for a query over `partners`. A partner with no row yet (sent
 * before `partner_owners`, or between the migration and the deploy) is its submitter's alone.
 */
export const ownerIdsOf = (partnerId: AnyColumn, submitterId: AnyColumn) =>
  sql<
    string[]
  >`coalesce(nullif(array(select ${partnerOwners.profileId} from ${partnerOwners} where ${partnerOwners.partnerId} = ${partnerId} order by ${partnerOwners.createdAt}), '{}'), array[${submitterId}])`.mapWith(
    textArray,
  );

/** The owners of one partner, the submitter alone when it has no row yet. */
export async function ownersOf(
  db: AnyDb,
  partner: Pick<Partner, 'id' | 'submitterId'>,
): Promise<string[]> {
  const rows = await db
    .select({ id: partnerOwners.profileId })
    .from(partnerOwners)
    .where(eq(partnerOwners.partnerId, partner.id))
    .orderBy(asc(partnerOwners.createdAt));
  return rows.length ? rows.map((row) => row.id) : [partner.submitterId];
}

/** The partner, locked so that two changes to who looks after it take turns. Removed is gone. */
async function lockPartner(db: AnyDb, id: string) {
  const [partner] = await db.select().from(partners).where(eq(partners.id, id)).for('update');
  if (!partner || partner.removedAt) throw new NotFound(`no partner "${id}"`);
  return partner;
}

/** Writes the submitter's row for a partner that has none, before anyone else is added. */
async function settleOwners(db: AnyDb, partner: Partner) {
  const owners = await ownersOf(db, partner);
  await db
    .insert(partnerOwners)
    .values({ partnerId: partner.id, profileId: partner.submitterId, createdAt: partner.createdAt })
    .onConflictDoNothing();
  return owners;
}

const lapsed = (invitation: Invitation, now: Date) =>
  invitation.status === 'pending' && invitation.expiresAt <= now;

const record = (
  db: AnyDb,
  type:
    | 'PartnerOwnerInvited'
    | 'PartnerInvitationAccepted'
    | 'PartnerInvitationDeclined'
    | 'PartnerInvitationCancelled'
    | 'PartnerInvitationExpired',
  invitation: Invitation,
  name: string,
  actorId: string | null,
  now: Date,
) =>
  recordEvent(
    db,
    {
      type,
      actorId,
      payload: {
        partnerId: invitation.partnerId,
        name,
        inviterId: invitation.inviterId,
        inviteeId: invitation.inviteeId,
        invitationId: invitation.id,
      },
    },
    { now },
  );

/** Ends a pending invite; nothing when it was answered meanwhile. Returns its event. */
async function finish(
  db: AnyDb,
  invitation: Invitation,
  partner: Partner,
  status: Ending,
  actorId: string | null,
  now: Date,
): Promise<string[]> {
  const [ended] = await db
    .update(partnerInvitations)
    .set({ status, respondedAt: now })
    .where(and(eq(partnerInvitations.id, invitation.id), eq(partnerInvitations.status, 'pending')))
    .returning();
  if (!ended) return [];
  const type = {
    accepted: 'PartnerInvitationAccepted',
    declined: 'PartnerInvitationDeclined',
    cancelled: 'PartnerInvitationCancelled',
    expired: 'PartnerInvitationExpired',
  } as const;
  return [await record(db, type[status], ended, partner.name, actorId, now)];
}

/**
 * An owner invites an account by its @username to look after the partner too. Refused alike
 * (`unavailable`) when the name is unknown, has no active profile, turned invitations off, already
 * looks after it, has an invite waiting or declined one in the last PARTNER_INVITATION_DAYS; and
 * with `too_many` once owners and waiting invites reach MAX_PARTNER_OWNERS. Returns the events.
 */
export async function invitePartnerOwner(
  db: AnyDb,
  actor: Actor | null,
  partnerId: string,
  username: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ invitationId: string; eventIds: string[] }> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const partner = await lockPartner(t, partnerId);
    const owners = await settleOwners(t, partner);
    authorize(actor, 'partner:edit', { ownerIds: owners });

    const [invitee] = await t
      .select({
        id: profiles.id,
        status: profiles.status,
        invitationsEnabled: profiles.invitationsEnabled,
      })
      .from(profiles)
      .where(eq(profiles.username, username.trim().replace(/^@/, '').toLowerCase()));
    if (
      !invitee ||
      invitee.status !== 'active' ||
      !invitee.invitationsEnabled ||
      owners.includes(invitee.id)
    )
      throw unavailable();

    const previous = await t
      .select()
      .from(partnerInvitations)
      .where(
        and(
          eq(partnerInvitations.partnerId, partner.id),
          eq(partnerInvitations.inviteeId, invitee.id),
        ),
      );
    const eventIds: string[] = [];
    for (const invitation of previous) {
      if (lapsed(invitation, now))
        eventIds.push(...(await finish(t, invitation, partner, 'expired', null, now)));
      else if (invitation.status === 'pending') throw unavailable();
      else if (
        invitation.status === 'declined' &&
        invitation.respondedAt &&
        now.getTime() - invitation.respondedAt.getTime() < PARTNER_INVITATION_DAYS * DAY
      )
        throw unavailable();
    }

    const waiting = await waitingInvitations(t, partner.id, now);
    if (owners.length + waiting.length >= MAX_PARTNER_OWNERS)
      throw new Invalid('username', 'too_many');

    await enforceRateLimit(
      t,
      actor!.id,
      { events: ['PartnerOwnerInvited'], max: 20, windowSeconds: 86_400 },
      now,
    );
    const [invitation] = await t
      .insert(partnerInvitations)
      .values({
        partnerId: partner.id,
        inviterId: actor!.id,
        inviteeId: invitee.id,
        createdAt: now,
        expiresAt: new Date(now.getTime() + PARTNER_INVITATION_DAYS * DAY),
      })
      .returning();
    eventIds.push(await record(t, 'PartnerOwnerInvited', invitation, partner.name, actor!.id, now));
    return { invitationId: invitation.id, eventIds };
  });
}

const waitingInvitations = (db: AnyDb, partnerId: string, now: Date) =>
  db
    .select({ id: partnerInvitations.id })
    .from(partnerInvitations)
    .where(
      and(
        eq(partnerInvitations.partnerId, partnerId),
        eq(partnerInvitations.status, 'pending'),
        gt(partnerInvitations.expiresAt, now),
      ),
    );

/** Opens an invitation for the person it names (`invitee`) or for an owner of its partner. */
async function withInvitation<T>(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  role: 'invitee' | 'owner',
  apply: (db: AnyDb, invitation: Invitation, partner: Partner) => Promise<T>,
) {
  if (!actor || actor.status !== 'active') throw new Forbidden();
  const [initial] = await db
    .select({ partnerId: partnerInvitations.partnerId })
    .from(partnerInvitations)
    .where(eq(partnerInvitations.id, id));
  if (!initial) throw new NotFound();
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [partner] = await t
      .select()
      .from(partners)
      .where(eq(partners.id, initial.partnerId))
      .for('update');
    const [invitation] = await t
      .select()
      .from(partnerInvitations)
      .where(eq(partnerInvitations.id, id));
    if (!partner || !invitation) throw new NotFound();
    if (role === 'invitee' && invitation.inviteeId !== actor.id) throw new NotFound();
    if (role === 'owner' && !(await ownersOf(t, partner)).includes(actor.id)) throw new NotFound();
    return apply(t, invitation, partner);
  });
}

/**
 * The invited person accepts or declines. A lapsed invite ends as `expired`; one whose partner was
 * removed meanwhile, or that would take the partner past the limit, as `cancelled`. Accepting adds
 * them to the owners. Returns how it ended and the events.
 */
export async function respondToPartnerInvitation(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  decision: 'accept' | 'decline',
  { now = new Date() }: { now?: Date } = {},
): Promise<{ status: Invitation['status']; eventIds: string[] }> {
  return withInvitation(db, actor, id, 'invitee', async (t, invitation, partner) => {
    if (invitation.status !== 'pending') return { status: invitation.status, eventIds: [] };
    if (lapsed(invitation, now))
      return {
        status: 'expired' as const,
        eventIds: await finish(t, invitation, partner, 'expired', null, now),
      };
    if (decision === 'decline')
      return {
        status: 'declined' as const,
        eventIds: await finish(t, invitation, partner, 'declined', actor!.id, now),
      };
    const owners = await settleOwners(t, partner);
    if (partner.removedAt || owners.length >= MAX_PARTNER_OWNERS)
      return {
        status: 'cancelled' as const,
        eventIds: await finish(t, invitation, partner, 'cancelled', null, now),
      };
    await t
      .insert(partnerOwners)
      .values({
        partnerId: partner.id,
        profileId: invitation.inviteeId,
        invitedBy: invitation.inviterId,
        createdAt: now,
      })
      .onConflictDoNothing();
    return {
      status: 'accepted' as const,
      eventIds: await finish(t, invitation, partner, 'accepted', actor!.id, now),
    };
  });
}

/** An owner withdraws an invite that still waits. Nobody is told; the invite page says so. */
export async function cancelPartnerInvitation(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ eventIds: string[] }> {
  return withInvitation(db, actor, id, 'owner', async (t, invitation, partner) => ({
    eventIds:
      invitation.status === 'pending'
        ? await finish(t, invitation, partner, 'cancelled', actor!.id, now)
        : [],
  }));
}

/**
 * An owner takes an account off the partner, or leaves it (`profileId` is their own). The last
 * owner cannot leave (`last_owner`): they withdraw the partner instead. Returns the events.
 */
export async function removePartnerOwner(
  db: AnyDb,
  actor: Actor | null,
  partnerId: string,
  profileId: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ eventIds: string[] }> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const partner = await lockPartner(t, partnerId);
    const owners = await settleOwners(t, partner);
    authorize(actor, 'partner:edit', { ownerIds: owners });
    if (!owners.includes(profileId)) throw new NotFound();
    if (owners.length === 1) throw new Invalid('owners', 'last_owner');
    await t
      .delete(partnerOwners)
      .where(and(eq(partnerOwners.partnerId, partner.id), eq(partnerOwners.profileId, profileId)));
    const eventId = await recordEvent(
      t,
      {
        type: 'PartnerOwnerRemoved',
        actorId: actor!.id,
        payload: { partnerId: partner.id, name: partner.name, profileId },
      },
      { now },
    );
    return { eventIds: [eventId] };
  });
}

/** Adds the submitter's row when a partner is sent, inside `addPartner`'s transaction. */
export async function addSubmitterAsOwner(
  db: AnyDb,
  partnerId: string,
  profileId: string,
  now: Date,
) {
  await db
    .insert(partnerOwners)
    .values({ partnerId, profileId, createdAt: now })
    .onConflictDoNothing();
}

/**
 * "Quem cuida do parceiro" on its edit page, for an owner: the owners in the order they joined
 * (who sent it first) and the invites that still wait.
 */
export async function listPartnerOwners(
  db: AnyDb,
  actor: Actor | null,
  partnerId: string,
  { now = new Date() }: { now?: Date } = {},
) {
  const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId));
  if (!partner || partner.removedAt) throw new NotFound(`no partner "${partnerId}"`);
  const ids = await ownersOf(db, partner);
  authorize(actor, 'partner:edit', { ownerIds: ids });

  const rows = await db
    .select({
      profileId: profiles.id,
      username: publicName(profiles.username),
      since: partnerOwners.createdAt,
    })
    .from(profiles)
    .leftJoin(
      partnerOwners,
      and(eq(partnerOwners.profileId, profiles.id), eq(partnerOwners.partnerId, partner.id)),
    )
    .where(inArray(profiles.id, ids));
  const owners = ids
    .map((id) => rows.find((row) => row.profileId === id))
    .filter((row) => row !== undefined)
    .map((row) => ({
      ...row,
      since: row.since ?? partner.createdAt,
      submitter: row.profileId === partner.submitterId,
    }));

  const invitations = await db
    .select({
      id: partnerInvitations.id,
      username: publicName(profiles.username),
      createdAt: partnerInvitations.createdAt,
      expiresAt: partnerInvitations.expiresAt,
    })
    .from(partnerInvitations)
    .innerJoin(profiles, eq(profiles.id, partnerInvitations.inviteeId))
    .where(
      and(
        eq(partnerInvitations.partnerId, partner.id),
        eq(partnerInvitations.status, 'pending'),
        gt(partnerInvitations.expiresAt, now),
      ),
    )
    .orderBy(asc(partnerInvitations.createdAt));
  return { owners, invitations };
}

/** The invite page, for the person invited only: anyone else gets a 404. */
export async function loadPartnerInvitation(db: AnyDb, actor: Actor | null, id: string) {
  if (!actor || actor.status !== 'active') throw new Forbidden();
  const [invitation] = await db
    .select({
      id: partnerInvitations.id,
      status: partnerInvitations.status,
      expiresAt: partnerInvitations.expiresAt,
      partner: {
        id: partners.id,
        name: partners.name,
        types: partners.types,
        logoPath: partners.logoPath,
        removed: sql<boolean>`${partners.removedAt} IS NOT NULL`,
      },
      inviter: publicName(profiles.username),
    })
    .from(partnerInvitations)
    .innerJoin(partners, eq(partners.id, partnerInvitations.partnerId))
    .innerJoin(profiles, eq(profiles.id, partnerInvitations.inviterId))
    .where(and(eq(partnerInvitations.id, id), eq(partnerInvitations.inviteeId, actor.id)));
  if (!invitation) throw new NotFound();
  return invitation;
}
