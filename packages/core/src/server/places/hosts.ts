import { and, asc, eq, gt, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { MAX_PLACE_HOSTS, PLACE_HOST_INVITATION_DAYS } from '../../places/hosts';
import { authorize, type Actor } from '@mesaaberta/core/server/auth/policy';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { publicName } from '@mesaaberta/core/server/db/public-name';
import {
  placeHostInvitations,
  placeHosts,
  places,
  profiles,
} from '@mesaaberta/core/server/db/schema';
import { Forbidden, Invalid, NotFound } from '@mesaaberta/core/server/errors';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';
import { enforceRateLimit } from '@mesaaberta/core/server/rate-limit';

// "Quem mestra na casa" (`place_hosts`) and the invites that add someone to it. The place's owner
// (or an admin) invites by @username, cancels an invite and takes someone off; the person accepts
// or declines, and leaves whenever they like. An owner who names themself is added at once. An
// invite counts against MAX_PLACE_HOSTS while it waits. Whoever is refused an invite hears the
// same `unavailable`, whether the account does not exist, cannot receive it or is already there.

type Place = typeof places.$inferSelect;
type Invitation = typeof placeHostInvitations.$inferSelect;
type Ending = 'accepted' | 'declined' | 'cancelled' | 'expired';

const DAY = 86_400_000;
const unavailable = () => new Invalid('username', 'unavailable');

/** A listed place (approved, not removed), locked so that two changes take turns. */
async function lockPlace(db: AnyDb, id: string) {
  const [place] = await db.select().from(places).where(eq(places.id, id)).for('update');
  if (!place || place.removedAt || !place.approvedAt) throw new NotFound(`no place "${id}"`);
  return place;
}

/** The id of the place with this slug (removed or not); `NotFound` for none. */
export async function placeIdOf(db: AnyDb, slug: string): Promise<string> {
  const [place] = await db.select({ id: places.id }).from(places).where(eq(places.slug, slug));
  if (!place) throw new NotFound(`no place "${slug}"`);
  return place.id;
}

const hostIdsOf = async (db: AnyDb, placeId: string) =>
  (
    await db
      .select({ id: placeHosts.profileId })
      .from(placeHosts)
      .where(eq(placeHosts.placeId, placeId))
  ).map((row) => row.id);

const waitingInvitations = (db: AnyDb, placeId: string, now: Date) =>
  db
    .select({ id: placeHostInvitations.id })
    .from(placeHostInvitations)
    .where(
      and(
        eq(placeHostInvitations.placeId, placeId),
        eq(placeHostInvitations.status, 'pending'),
        gt(placeHostInvitations.expiresAt, now),
      ),
    );

const lapsed = (invitation: Invitation, now: Date) =>
  invitation.status === 'pending' && invitation.expiresAt <= now;

const fact = (place: Place) => ({ placeId: place.id, slug: place.slug, name: place.name });

const record = (
  db: AnyDb,
  type:
    | 'PlaceHostInvited'
    | 'PlaceHostInvitationAccepted'
    | 'PlaceHostInvitationDeclined'
    | 'PlaceHostInvitationCancelled'
    | 'PlaceHostInvitationExpired',
  invitation: Invitation,
  place: Place,
  actorId: string | null,
  now: Date,
) =>
  recordEvent(
    db,
    {
      type,
      actorId,
      payload: {
        ...fact(place),
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
  place: Place,
  status: Ending,
  actorId: string | null,
  now: Date,
): Promise<string[]> {
  const [ended] = await db
    .update(placeHostInvitations)
    .set({ status, respondedAt: now })
    .where(
      and(eq(placeHostInvitations.id, invitation.id), eq(placeHostInvitations.status, 'pending')),
    )
    .returning();
  if (!ended) return [];
  const type = {
    accepted: 'PlaceHostInvitationAccepted',
    declined: 'PlaceHostInvitationDeclined',
    cancelled: 'PlaceHostInvitationCancelled',
    expired: 'PlaceHostInvitationExpired',
  } as const;
  return [await record(db, type[status], ended, place, actorId, now)];
}

/**
 * The place's owner (or an admin) invites someone by @username to be a house GM. Refused alike
 * (`unavailable`) when the name is unknown, has no active profile, turned invitations off, is
 * already there, has an invite waiting or declined one in the last PLACE_HOST_INVITATION_DAYS; and
 * with `too_many` once house GMs and waiting invites reach MAX_PLACE_HOSTS. Naming oneself adds
 * one at once. Returns the events.
 */
export async function invitePlaceHost(
  db: AnyDb,
  actor: Actor | null,
  placeId: string,
  username: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ invitationId: string | null; eventIds: string[] }> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const place = await lockPlace(t, placeId);
    authorize(actor, 'place:hosts', { ownerId: place.ownerId });

    const [invitee] = await t
      .select({
        id: profiles.id,
        status: profiles.status,
        invitationsEnabled: profiles.invitationsEnabled,
      })
      .from(profiles)
      .where(eq(profiles.username, username.trim().replace(/^@/, '').toLowerCase()));
    const hosts = await hostIdsOf(t, place.id);
    if (!invitee || invitee.status !== 'active' || hosts.includes(invitee.id)) throw unavailable();

    const waiting = await waitingInvitations(t, place.id, now);
    if (hosts.length + waiting.length >= MAX_PLACE_HOSTS) throw new Invalid('username', 'too_many');

    if (invitee.id === actor!.id) {
      await t
        .insert(placeHosts)
        .values({ placeId: place.id, profileId: actor!.id, createdAt: now })
        .onConflictDoNothing();
      return { invitationId: null, eventIds: [] };
    }
    if (!invitee.invitationsEnabled) throw unavailable();

    const previous = await t
      .select()
      .from(placeHostInvitations)
      .where(
        and(
          eq(placeHostInvitations.placeId, place.id),
          eq(placeHostInvitations.inviteeId, invitee.id),
        ),
      );
    const eventIds: string[] = [];
    for (const invitation of previous) {
      if (lapsed(invitation, now))
        eventIds.push(...(await finish(t, invitation, place, 'expired', null, now)));
      else if (invitation.status === 'pending') throw unavailable();
      else if (
        invitation.status === 'declined' &&
        invitation.respondedAt &&
        now.getTime() - invitation.respondedAt.getTime() < PLACE_HOST_INVITATION_DAYS * DAY
      )
        throw unavailable();
    }

    await enforceRateLimit(
      t,
      actor!.id,
      { events: ['PlaceHostInvited'], max: 20, windowSeconds: 86_400 },
      now,
    );
    const [invitation] = await t
      .insert(placeHostInvitations)
      .values({
        placeId: place.id,
        inviterId: actor!.id,
        inviteeId: invitee.id,
        createdAt: now,
        expiresAt: new Date(now.getTime() + PLACE_HOST_INVITATION_DAYS * DAY),
      })
      .returning();
    eventIds.push(await record(t, 'PlaceHostInvited', invitation, place, actor!.id, now));
    return { invitationId: invitation.id, eventIds };
  });
}

/** Opens an invitation for the person it names, or for whoever may manage the place's hosts. */
async function withInvitation<T>(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  role: 'invitee' | 'manager',
  apply: (db: AnyDb, invitation: Invitation, place: Place) => Promise<T>,
) {
  if (!actor || actor.status !== 'active') throw new Forbidden();
  const [initial] = await db
    .select({ placeId: placeHostInvitations.placeId })
    .from(placeHostInvitations)
    .where(eq(placeHostInvitations.id, id));
  if (!initial) throw new NotFound();
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [place] = await t
      .select()
      .from(places)
      .where(eq(places.id, initial.placeId))
      .for('update');
    const [invitation] = await t
      .select()
      .from(placeHostInvitations)
      .where(eq(placeHostInvitations.id, id));
    if (!place || !invitation) throw new NotFound();
    if (role === 'invitee' && invitation.inviteeId !== actor.id) throw new NotFound();
    if (role === 'manager') authorize(actor, 'place:hosts', { ownerId: place.ownerId });
    return apply(t, invitation, place);
  });
}

/**
 * The invited person accepts or declines. A lapsed invite ends as `expired`; one whose place left
 * the list meanwhile, or that would take it past the limit, as `cancelled`. Accepting adds them to
 * the house GMs. Returns how it ended and the events.
 */
export async function respondToPlaceHostInvitation(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  decision: 'accept' | 'decline',
  { now = new Date() }: { now?: Date } = {},
): Promise<{ status: Invitation['status']; eventIds: string[] }> {
  return withInvitation(db, actor, id, 'invitee', async (t, invitation, place) => {
    if (invitation.status !== 'pending') return { status: invitation.status, eventIds: [] };
    if (lapsed(invitation, now))
      return {
        status: 'expired' as const,
        eventIds: await finish(t, invitation, place, 'expired', null, now),
      };
    if (decision === 'decline')
      return {
        status: 'declined' as const,
        eventIds: await finish(t, invitation, place, 'declined', actor!.id, now),
      };
    const hosts = await hostIdsOf(t, place.id);
    if (place.removedAt || !place.approvedAt || hosts.length >= MAX_PLACE_HOSTS)
      return {
        status: 'cancelled' as const,
        eventIds: await finish(t, invitation, place, 'cancelled', null, now),
      };
    await t
      .insert(placeHosts)
      .values({
        placeId: place.id,
        profileId: invitation.inviteeId,
        invitedBy: invitation.inviterId,
        createdAt: now,
      })
      .onConflictDoNothing();
    return {
      status: 'accepted' as const,
      eventIds: await finish(t, invitation, place, 'accepted', actor!.id, now),
    };
  });
}

/** The owner (or an admin) withdraws an invite that still waits. Nobody is told. */
export async function cancelPlaceHostInvitation(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ eventIds: string[] }> {
  return withInvitation(db, actor, id, 'manager', async (t, invitation, place) => ({
    eventIds:
      invitation.status === 'pending'
        ? await finish(t, invitation, place, 'cancelled', actor!.id, now)
        : [],
  }));
}

/**
 * Takes a house GM off the place: the owner or an admin takes anyone off, and a house GM takes
 * themself off ("Sair"). Returns the `PlaceHostRemoved` event.
 */
export async function removePlaceHost(
  db: AnyDb,
  actor: Actor | null,
  placeId: string,
  profileId: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ eventIds: string[] }> {
  if (!actor || actor.status !== 'active') throw new Forbidden();
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [place] = await t.select().from(places).where(eq(places.id, placeId)).for('update');
    if (!place || place.removedAt) throw new NotFound(`no place "${placeId}"`);
    if (profileId !== actor.id) authorize(actor, 'place:hosts', { ownerId: place.ownerId });
    const [removed] = await t
      .delete(placeHosts)
      .where(and(eq(placeHosts.placeId, place.id), eq(placeHosts.profileId, profileId)))
      .returning();
    if (!removed) throw new NotFound();
    const eventId = await recordEvent(
      t,
      { type: 'PlaceHostRemoved', actorId: actor.id, payload: { ...fact(place), profileId } },
      { now },
    );
    return { eventIds: [eventId] };
  });
}

/**
 * "Quem mestra na casa" on the place's edit page, for its owner or an admin: the house GMs in the
 * order they joined and the invites that still wait.
 */
export async function listPlaceHosts(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  { now = new Date() }: { now?: Date } = {},
) {
  const [place] = await db
    .select()
    .from(places)
    .where(and(eq(places.slug, slug), isNull(places.removedAt), isNotNull(places.approvedAt)));
  if (!place) throw new NotFound(`no place "${slug}"`);
  authorize(actor, 'place:hosts', { ownerId: place.ownerId });

  const hosts = await db
    .select({
      profileId: profiles.id,
      username: publicName(profiles.username),
      since: placeHosts.createdAt,
    })
    .from(placeHosts)
    .innerJoin(profiles, eq(profiles.id, placeHosts.profileId))
    .where(eq(placeHosts.placeId, place.id))
    .orderBy(asc(placeHosts.createdAt));
  const invitations = await db
    .select({
      id: placeHostInvitations.id,
      username: publicName(profiles.username),
      createdAt: placeHostInvitations.createdAt,
      expiresAt: placeHostInvitations.expiresAt,
    })
    .from(placeHostInvitations)
    .innerJoin(profiles, eq(profiles.id, placeHostInvitations.inviteeId))
    .where(
      and(
        eq(placeHostInvitations.placeId, place.id),
        eq(placeHostInvitations.status, 'pending'),
        gt(placeHostInvitations.expiresAt, now),
      ),
    )
    .orderBy(asc(placeHostInvitations.createdAt));
  return { placeId: place.id, hosts, invitations };
}

/** The invite page, for the person invited only: anyone else gets a 404. */
export async function loadPlaceHostInvitation(db: AnyDb, actor: Actor | null, id: string) {
  if (!actor || actor.status !== 'active') throw new Forbidden();
  const [invitation] = await db
    .select({
      id: placeHostInvitations.id,
      status: placeHostInvitations.status,
      expiresAt: placeHostInvitations.expiresAt,
      place: {
        id: places.id,
        slug: places.slug,
        name: places.name,
        kind: places.kind,
        imagePath: places.imagePath,
        removed: sql<boolean>`${places.removedAt} IS NOT NULL`,
      },
      inviter: publicName(profiles.username),
    })
    .from(placeHostInvitations)
    .innerJoin(places, eq(places.id, placeHostInvitations.placeId))
    .innerJoin(profiles, eq(profiles.id, placeHostInvitations.inviterId))
    .where(and(eq(placeHostInvitations.id, id), eq(placeHostInvitations.inviteeId, actor.id)));
  if (!invitation) throw new NotFound();
  return invitation;
}

/** The listed places where each person is a house GM, A to Z: "Mestra em" on profiles and cards. */
export async function hostedPlacesOf(db: AnyDb, profileIds: readonly string[]) {
  if (profileIds.length === 0)
    return new Map<string, { id: string; slug: string; name: string }[]>();
  const rows = await db
    .select({
      profileId: placeHosts.profileId,
      id: places.id,
      slug: places.slug,
      name: places.name,
    })
    .from(placeHosts)
    .innerJoin(places, eq(places.id, placeHosts.placeId))
    .where(
      and(
        inArray(placeHosts.profileId, [...profileIds]),
        isNotNull(places.approvedAt),
        isNull(places.removedAt),
        isNull(places.hiddenAt),
      ),
    )
    .orderBy(asc(sql`lower(${places.name})`));
  const hosted = new Map<string, { id: string; slug: string; name: string }[]>();
  for (const { profileId, ...place } of rows)
    hosted.set(profileId, [...(hosted.get(profileId) ?? []), place]);
  return hosted;
}
