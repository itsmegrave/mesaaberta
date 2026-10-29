import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { partnerLinkFilters } from '../../places/partner-links';
import { authorize, can, type Actor } from '@mesaaberta/core/server/auth/policy';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import {
  partners,
  partnerShownGms,
  placePartnerLinks,
  places,
  profiles,
} from '@mesaaberta/core/server/db/schema';
import { Invalid, NotFound } from '@mesaaberta/core/server/errors';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';
import { ownerIdsOf, ownersOf } from '../partners/owners';

// A place that is also a partner ("Parceiro Mesa Aberta"). Someone who is the place's owner and
// looks after the partner asks from the place's edit page; an admin approves or rejects it from
// `/admin/places/links`. A place has at most one partner; a partner may have many places. Either
// side, or an admin, can take the link down again. Errors are codes only; the web app words them.

type Link = typeof placePartnerLinks.$inferSelect;
type LinkStatus = Link['status'];

const fact = (
  link: Pick<Link, 'id' | 'partnerId' | 'requestedBy'>,
  place: { id: string; slug: string; name: string },
  partner: { name: string },
) => ({
  linkId: link.id,
  placeId: place.id,
  slug: place.slug,
  name: place.name,
  partnerId: link.partnerId,
  partnerName: partner.name,
  requestedBy: link.requestedBy,
});

/** A place that is on the list (approved, not removed), locked for the change. */
async function listedPlace(t: AnyDb, slug: string) {
  const [place] = await t
    .select()
    .from(places)
    .where(and(eq(places.slug, slug), isNotNull(places.approvedAt), isNull(places.removedAt)))
    .for('update');
  if (!place) throw new NotFound(`no place "${slug}"`);
  return place;
}

/** A partner that is on its page (approved, not removed), with who looks after it. */
async function listedPartner(t: AnyDb, id: string) {
  const [partner] = await t
    .select()
    .from(partners)
    .where(and(eq(partners.id, id), isNotNull(partners.approvedAt), isNull(partners.removedAt)));
  if (!partner) throw new Invalid('partnerId', 'unavailable');
  return { ...partner, ownerIds: await ownersOf(t, partner) };
}

async function linkOf(t: AnyDb, placeId: string, status: LinkStatus) {
  const [link] = await t
    .select({
      id: placePartnerLinks.id,
      partnerId: placePartnerLinks.partnerId,
      requestedBy: placePartnerLinks.requestedBy,
      createdAt: placePartnerLinks.createdAt,
      partnerName: partners.name,
    })
    .from(placePartnerLinks)
    .innerJoin(partners, eq(partners.id, placePartnerLinks.partnerId))
    .where(and(eq(placePartnerLinks.placeId, placeId), eq(placePartnerLinks.status, status)));
  return (link as typeof link | undefined) ?? null;
}

/** The partners a person looks after that are on their page, by name: what "Parceiro" offers. */
export async function partnersLookedAfter(db: AnyDb, profileId: string) {
  return db
    .select({ id: partners.id, name: partners.name })
    .from(partners)
    .where(
      and(
        isNotNull(partners.approvedAt),
        isNull(partners.removedAt),
        sql`${profileId}::uuid = any(${ownerIdsOf(partners.id, partners.submitterId)})`,
      ),
    )
    .orderBy(asc(sql`lower(${partners.name})`));
}

/**
 * The "Parceiro" section of a place's edit page, for whoever may ask (the place's owner or an
 * admin; null for anyone else): the link that is up, the request that waits, and the partners the
 * person could ask for.
 */
export async function placePartnerState(db: AnyDb, actor: Actor, slug: string) {
  const [place] = await db
    .select({ id: places.id, ownerId: places.ownerId })
    .from(places)
    .where(and(eq(places.slug, slug), isNotNull(places.approvedAt), isNull(places.removedAt)));
  if (!place) return null;
  const isAdmin = can(actor, 'admin:access');
  if (!isAdmin && actor.id !== place.ownerId) return null;
  const [approved, pending, options] = await Promise.all([
    linkOf(db, place.id, 'approved'),
    linkOf(db, place.id, 'pending'),
    partnersLookedAfter(db, actor.id),
  ]);
  const pick = (link: NonNullable<Awaited<ReturnType<typeof linkOf>>>) => ({
    id: link.id,
    partnerId: link.partnerId,
    name: link.partnerName,
  });
  return {
    approved: approved ? pick(approved) : null,
    pending: pending ? { ...pick(pending), createdAt: pending.createdAt } : null,
    options,
  };
}

/**
 * Asks to show the place as the partner's ("Parceiro Mesa Aberta"). Only someone who owns the place
 * and looks after the partner, or an admin. A request already waiting is replaced; asking for the
 * partner it already has is `already_linked`. Returns the `PlacePartnerLinkRequested` event.
 */
export async function requestPlacePartner(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  partnerId: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const place = await listedPlace(t, slug);
    const partner = await listedPartner(t, partnerId);
    authorize(actor, 'place:linkPartner', {
      placeOwnerId: place.ownerId,
      partnerOwnerIds: partner.ownerIds,
    });
    const approved = await linkOf(t, place.id, 'approved');
    if (approved?.partnerId === partner.id) throw new Invalid('partnerId', 'already_linked');

    await t
      .update(placePartnerLinks)
      .set({ status: 'cancelled', updatedAt: now })
      .where(and(eq(placePartnerLinks.placeId, place.id), eq(placePartnerLinks.status, 'pending')));
    const [link] = await t
      .insert(placePartnerLinks)
      .values({
        placeId: place.id,
        partnerId: partner.id,
        requestedBy: actor!.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return [
      await recordEvent(
        t,
        {
          type: 'PlacePartnerLinkRequested',
          actorId: actor!.id,
          payload: fact(link, place, partner),
        },
        { now },
      ),
    ];
  });
}

/**
 * Withdraws the request that waits (`pending`) or takes the link that is up down (`approved`):
 * either side or an admin. Nothing there is `not_found`. Taking a link down records
 * `PlacePartnerUnlinked`; withdrawing a request records nothing.
 */
export async function endPlacePartner(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  which: 'pending' | 'approved',
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const place = await listedPlace(t, slug);
    const link = await linkOf(t, place.id, which);
    if (!link) throw new Invalid('', 'not_found');
    const [partner] = await t.select().from(partners).where(eq(partners.id, link.partnerId));
    authorize(actor, 'place:unlinkPartner', {
      placeOwnerId: place.ownerId,
      partnerOwnerIds: await ownersOf(t, partner),
    });
    await t
      .update(placePartnerLinks)
      .set({ status: which === 'pending' ? 'cancelled' : 'removed', updatedAt: now })
      .where(eq(placePartnerLinks.id, link.id));
    if (which === 'pending') return [];
    return [
      await recordEvent(
        t,
        {
          type: 'PlacePartnerUnlinked',
          actorId: actor!.id,
          payload: fact(link, place, partner),
        },
        { now },
      ),
    ];
  });
}

/** How many requests wait for an admin, counted beside "Lugares" with the claims. */
export async function pendingPartnerLinkCount(db: AnyDb): Promise<number> {
  const [{ pending }] = await db
    .select({ pending: count() })
    .from(placePartnerLinks)
    .where(eq(placePartnerLinks.status, 'pending'));
  return pending;
}

const requester = alias(profiles, 'requester');

/**
 * One page of the requests for `/admin/places/links`, oldest first, opening on those that wait.
 * Each names the place, the partner and who asked. `page` past the last one is `null`.
 */
export async function listPartnerLinks(db: AnyDb, actor: Actor | null, params: URLSearchParams) {
  authorize(actor, 'moderation:manage');
  const filters = partnerLinkFilters(params);
  const where =
    filters.status === 'all'
      ? inArray(placePartnerLinks.status, ['pending', 'approved', 'rejected'])
      : eq(placePartnerLinks.status, filters.status);
  const [{ total }] = await db.select({ total: count() }).from(placePartnerLinks).where(where);
  const pages = Math.max(1, Math.ceil(total / filters.pageSize));
  if (filters.page > pages) return null;

  const rows = await db
    .select({
      id: placePartnerLinks.id,
      status: placePartnerLinks.status,
      createdAt: placePartnerLinks.createdAt,
      decisionNote: placePartnerLinks.decisionNote,
      place: { slug: places.slug, name: places.name },
      partner: { id: partners.id, name: partners.name },
      requester: { username: requester.username },
    })
    .from(placePartnerLinks)
    .innerJoin(places, eq(places.id, placePartnerLinks.placeId))
    .innerJoin(partners, eq(partners.id, placePartnerLinks.partnerId))
    .leftJoin(requester, eq(requester.id, placePartnerLinks.requestedBy))
    .where(where)
    .orderBy(
      filters.status === 'pending'
        ? asc(placePartnerLinks.createdAt)
        : desc(placePartnerLinks.createdAt),
      asc(placePartnerLinks.id),
    )
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  return { ...filters, total, pages, rows };
}

export type AdminPartnerLinks = NonNullable<Awaited<ReturnType<typeof listPartnerLinks>>>;

async function waitingLink(t: AnyDb, id: string) {
  const [link] = await t
    .select()
    .from(placePartnerLinks)
    .where(eq(placePartnerLinks.id, id))
    .for('update');
  if (!link) throw new Invalid('id', 'not_found');
  if (link.status !== 'pending') throw new Invalid('id', 'closed');
  const [place] = await t.select().from(places).where(eq(places.id, link.placeId)).for('update');
  const [partner] = await t.select().from(partners).where(eq(partners.id, link.partnerId));
  return { link, place, partner };
}

/**
 * An admin approves a request: the place shows the partner, and the partner the place. A link the
 * place had with another partner comes down. Refused when either side left its page (`closed`).
 */
export async function approvePartnerLink(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const { link, place, partner } = await waitingLink(t, id);
    if (place.removedAt || !place.approvedAt || partner.removedAt || !partner.approvedAt)
      throw new Invalid('id', 'closed');

    await t
      .update(placePartnerLinks)
      .set({ status: 'removed', updatedAt: now })
      .where(
        and(eq(placePartnerLinks.placeId, place.id), eq(placePartnerLinks.status, 'approved')),
      );
    await t
      .update(placePartnerLinks)
      .set({ status: 'approved', decidedBy: actor!.id, decidedAt: now, updatedAt: now })
      .where(eq(placePartnerLinks.id, link.id));
    return [
      await recordEvent(
        t,
        {
          type: 'PlacePartnerLinkApproved',
          actorId: actor!.id,
          payload: fact(link, place, partner),
        },
        { now },
      ),
    ];
  });
}

/** An admin turns a request down, with a note the requester reads. */
export async function rejectPartnerLink(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  { note }: { note: string },
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const { link, place, partner } = await waitingLink(t, id);
    await t
      .update(placePartnerLinks)
      .set({
        status: 'rejected',
        decidedBy: actor!.id,
        decidedAt: now,
        decisionNote: note.trim() || null,
        updatedAt: now,
      })
      .where(eq(placePartnerLinks.id, link.id));
    return [
      await recordEvent(
        t,
        {
          type: 'PlacePartnerLinkRejected',
          actorId: actor!.id,
          payload: fact(link, place, partner),
        },
        { now },
      ),
    ];
  });
}

/** The partner a place shows ("Parceiro Mesa Aberta"), when its link is up and the partner listed. */
export async function partnerOfPlace(db: AnyDb, placeId: string) {
  const [row] = await db
    .select({ id: partners.id, name: partners.name })
    .from(placePartnerLinks)
    .innerJoin(partners, eq(partners.id, placePartnerLinks.partnerId))
    .where(
      and(
        eq(placePartnerLinks.placeId, placeId),
        eq(placePartnerLinks.status, 'approved'),
        isNotNull(partners.approvedAt),
        isNull(partners.removedAt),
      ),
    );
  return (row as typeof row | undefined) ?? null;
}

/** Whether a place's link to a listed partner is up, as a condition over `places`. */
export const isPartnerPlace = () =>
  sql<boolean>`exists (select 1 from ${placePartnerLinks} join ${partners} on ${partners.id} = ${placePartnerLinks.partnerId} where ${placePartnerLinks.placeId} = ${places.id} and ${placePartnerLinks.status} = 'approved' and ${partners.approvedAt} is not null and ${partners.removedAt} is null)`;

/** The ids of the listed places a partner's links show, newest link first. */
export async function placeIdsOfPartner(db: AnyDb, partnerId: string): Promise<string[]> {
  const rows = await db
    .select({ id: places.id })
    .from(placePartnerLinks)
    .innerJoin(places, eq(places.id, placePartnerLinks.placeId))
    .where(
      and(
        eq(placePartnerLinks.partnerId, partnerId),
        eq(placePartnerLinks.status, 'approved'),
        isNotNull(places.approvedAt),
        isNull(places.removedAt),
        isNull(places.hiddenAt),
      ),
    )
    .orderBy(desc(placePartnerLinks.decidedAt));
  return rows.map((row) => row.id);
}

/**
 * Who shows under "Quem mestra" on a partner's page: the accounts that look after it, turned it on
 * for themselves and say on their profile that they run games. In the order they turned it on.
 */
export async function shownGmsOf(db: AnyDb, partnerIds: readonly string[]): Promise<ShownGm[]> {
  if (partnerIds.length === 0) return [];
  const rows = await db
    .select({
      partnerId: partnerShownGms.partnerId,
      username: profiles.username,
      name: profiles.name,
      showName: profiles.showName,
      avatarPath: profiles.avatarPath,
      avatarUrl: profiles.avatarUrl,
    })
    .from(partnerShownGms)
    .innerJoin(partners, eq(partners.id, partnerShownGms.partnerId))
    .innerJoin(profiles, eq(profiles.id, partnerShownGms.profileId))
    .where(
      and(
        inArray(partnerShownGms.partnerId, [...partnerIds]),
        inArray(profiles.tableRole, ['gm', 'both']),
        eq(profiles.status, 'active'),
        isNotNull(profiles.username),
        sql`${profiles.id} = any(${ownerIdsOf(partners.id, partners.submitterId)})`,
      ),
    )
    .orderBy(asc(partnerShownGms.createdAt));
  return rows.map((row) => ({
    partnerId: row.partnerId,
    username: row.username!,
    name: (row.showName && row.name) || null,
    avatarPath: row.avatarPath,
    avatarUrl: row.avatarUrl,
  }));
}

/** A person under "Quem mestra" on a partner: the name only where they chose to show it. */
export type ShownGm = {
  partnerId: string;
  username: string;
  name: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
};

/**
 * Turns "Mostrar meu perfil em Quem mestra" on or off for the actor on a partner they look after.
 * Anyone else is `Forbidden`.
 */
export async function setShownAsGm(
  db: AnyDb,
  actor: Actor | null,
  partnerId: string,
  show: boolean,
): Promise<void> {
  const [partner] = await db
    .select()
    .from(partners)
    .where(and(eq(partners.id, partnerId), isNull(partners.removedAt)));
  if (!partner) throw new NotFound(`no partner "${partnerId}"`);
  authorize(actor, 'partner:edit', { ownerIds: await ownersOf(db, partner) });
  if (show)
    await db
      .insert(partnerShownGms)
      .values({ partnerId, profileId: actor!.id })
      .onConflictDoNothing();
  else
    await db
      .delete(partnerShownGms)
      .where(
        and(eq(partnerShownGms.partnerId, partnerId), eq(partnerShownGms.profileId, actor!.id)),
      );
}

/** Whether the actor shows under "Quem mestra" on the partner, for its edit page. */
export async function isShownAsGm(db: AnyDb, partnerId: string, profileId: string) {
  const [row] = await db
    .select({ partnerId: partnerShownGms.partnerId })
    .from(partnerShownGms)
    .where(and(eq(partnerShownGms.partnerId, partnerId), eq(partnerShownGms.profileId, profileId)));
  return !!row;
}

/** What a partner's card says of its links: how many listed places, and who mestra there. */
export type PartnerReach = { places: number; gms: string[] };

/** How many GMs a partner's card names; the page lists them all. */
export const PARTNER_CARD_GMS = 2;

/** The reach of each partner on a page of `/partners`, by id (absent when it has none). */
export async function partnerReachOf(
  db: AnyDb,
  partnerIds: readonly string[],
): Promise<Map<string, PartnerReach>> {
  if (partnerIds.length === 0) return new Map();
  const [counts, gms] = await Promise.all([
    db
      .select({ partnerId: placePartnerLinks.partnerId, places: sql<number>`count(*)::int` })
      .from(placePartnerLinks)
      .innerJoin(places, eq(places.id, placePartnerLinks.placeId))
      .where(
        and(
          inArray(placePartnerLinks.partnerId, [...partnerIds]),
          eq(placePartnerLinks.status, 'approved'),
          isNotNull(places.approvedAt),
          isNull(places.removedAt),
          isNull(places.hiddenAt),
        ),
      )
      .groupBy(placePartnerLinks.partnerId),
    shownGmsOf(db, partnerIds),
  ]);
  const reach = new Map<string, PartnerReach>();
  const of = (id: string) => {
    if (!reach.has(id)) reach.set(id, { places: 0, gms: [] });
    return reach.get(id)!;
  };
  for (const row of counts) of(row.partnerId).places = row.places;
  for (const gm of gms) {
    const entry = of(gm.partnerId);
    if (entry.gms.length < PARTNER_CARD_GMS) entry.gms.push(gm.username);
  }
  return reach;
}
