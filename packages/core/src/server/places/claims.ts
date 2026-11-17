import { and, asc, count, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  placeClaimFilters,
  type PlaceClaimInput,
  type PlaceClaimRelation,
} from '../../places/claims';
import { authorize, type Actor } from '@mesaaberta/core/server/auth/policy';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { placeClaims, places, profiles } from '@mesaaberta/core/server/db/schema';
import { Invalid, NotFound } from '@mesaaberta/core/server/errors';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';
import { enforceRateLimit, PLACE_CLAIM_LIMIT } from '@mesaaberta/core/server/rate-limit';

// A store (or whoever runs the games there) asks to manage its place. An admin approves, and the
// claimant owns the place: their edits publish at once, and the page says "Verificado pelo lugar".
// Errors are codes only; the web app words them.

/**
 * A member claims a listed place nobody owns. Refused when it has an owner already
 * (`place_already_owned`) and while their own claim on it waits (`claim_pending`). Returns the
 * `PlaceClaimed` event to dispatch.
 */
export async function fileClaim(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  input: PlaceClaimInput,
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  authorize(actor, 'place:claim');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [place] = await t
      .select()
      .from(places)
      .where(
        and(
          eq(places.slug, slug),
          isNotNull(places.approvedAt),
          isNull(places.removedAt),
          isNull(places.hiddenAt),
        ),
      )
      .for('update');
    if (!place) throw new NotFound(`no place "${slug}"`);
    if (place.ownerId) throw new Invalid('', 'place_already_owned');
    await enforceRateLimit(t, actor!.id, PLACE_CLAIM_LIMIT, now);

    const [claim] = await t
      .insert(placeClaims)
      .values({
        placeId: place.id,
        claimantId: actor!.id,
        relation: input.relation,
        contact: input.contact,
        note: input.note || null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: placeClaims.id });
    if (!claim) throw new Invalid('', 'claim_pending');

    return [
      await recordEvent(
        t,
        {
          type: 'PlaceClaimed',
          actorId: actor!.id,
          payload: {
            claimId: claim.id,
            claimantId: actor!.id,
            placeId: place.id,
            slug: place.slug,
            name: place.name,
          },
        },
        { now },
      ),
    ];
  });
}

/** Whether this member's claim on the place still waits, for the claim page's "Aguardando análise". */
export async function pendingClaimOf(db: AnyDb, placeId: string, claimantId: string) {
  const [claim] = await db
    .select({ id: placeClaims.id, createdAt: placeClaims.createdAt })
    .from(placeClaims)
    .where(
      and(
        eq(placeClaims.placeId, placeId),
        eq(placeClaims.claimantId, claimantId),
        eq(placeClaims.status, 'pending'),
      ),
    );
  return claim ?? null;
}

/** How many claims wait for an admin, counted beside "Lugares" with the places that wait. */
export async function pendingClaimCount(db: AnyDb): Promise<number> {
  const [{ pending }] = await db
    .select({ pending: count() })
    .from(placeClaims)
    .where(eq(placeClaims.status, 'pending'));
  return pending;
}

const claimant = alias(profiles, 'claimant');

/**
 * One page of the claims for `/admin/places/claims`, oldest first, opening on those that wait.
 * Each names the place, the claimant, who they say they are and how to reach them. `page` past
 * the last one is `null`.
 */
export async function listClaims(db: AnyDb, actor: Actor | null, params: URLSearchParams) {
  authorize(actor, 'moderation:manage');
  const filters = placeClaimFilters(params);
  const where = filters.status === 'all' ? undefined : eq(placeClaims.status, filters.status);
  const [{ total }] = await db.select({ total: count() }).from(placeClaims).where(where);
  const pages = Math.max(1, Math.ceil(total / filters.pageSize));
  if (filters.page > pages) return null;

  const rows = await db
    .select({
      id: placeClaims.id,
      relation: placeClaims.relation,
      contact: placeClaims.contact,
      note: placeClaims.note,
      status: placeClaims.status,
      createdAt: placeClaims.createdAt,
      decisionNote: placeClaims.decisionNote,
      place: {
        id: places.id,
        slug: places.slug,
        name: places.name,
        owned: isNotNull(places.ownerId),
      },
      claimant: { id: claimant.id, username: claimant.username },
    })
    .from(placeClaims)
    .innerJoin(places, eq(places.id, placeClaims.placeId))
    .innerJoin(claimant, eq(claimant.id, placeClaims.claimantId))
    .where(where)
    .orderBy(asc(placeClaims.createdAt), asc(placeClaims.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
  return {
    ...filters,
    total,
    pages,
    rows: rows.map((row) => ({ ...row, relation: row.relation as PlaceClaimRelation })),
  };
}

export type AdminClaims = NonNullable<Awaited<ReturnType<typeof listClaims>>>;

async function waitingClaim(t: AnyDb, id: string) {
  const [claim] = await t.select().from(placeClaims).where(eq(placeClaims.id, id)).for('update');
  if (!claim) throw new Invalid('id', 'not_found');
  if (claim.status !== 'pending') throw new Invalid('id', 'closed');
  const [place] = await t.select().from(places).where(eq(places.id, claim.placeId)).for('update');
  return { claim, place };
}

const claimFact = (
  claim: { id: string; claimantId: string },
  place: { id: string; slug: string; name: string },
) => ({
  claimId: claim.id,
  claimantId: claim.claimantId,
  placeId: place.id,
  slug: place.slug,
  name: place.name,
});

/**
 * An admin approves a claim: the claimant owns the place from now, and every other claim waiting
 * on it is rejected. Refused when the place is gone (`closed`) or has an owner already
 * (`place_already_owned`). Returns the events to dispatch.
 */
export async function approveClaim(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const { claim, place } = await waitingClaim(t, id);
    if (place.removedAt) throw new Invalid('id', 'closed');
    if (place.ownerId) throw new Invalid('id', 'place_already_owned');

    await t
      .update(places)
      .set({ ownerId: claim.claimantId, ownerSince: now })
      .where(eq(places.id, place.id));
    await t
      .update(placeClaims)
      .set({ status: 'approved', decidedBy: actor!.id, decidedAt: now, updatedAt: now })
      .where(eq(placeClaims.id, claim.id));
    const eventIds = [
      await recordEvent(
        t,
        { type: 'PlaceClaimApproved', actorId: actor!.id, payload: claimFact(claim, place) },
        { now },
      ),
    ];

    const others = await t
      .update(placeClaims)
      .set({ status: 'rejected', decidedBy: actor!.id, decidedAt: now, updatedAt: now })
      .where(
        and(
          eq(placeClaims.placeId, place.id),
          eq(placeClaims.status, 'pending'),
          ne(placeClaims.id, claim.id),
        ),
      )
      .returning({ id: placeClaims.id, claimantId: placeClaims.claimantId });
    for (const other of others)
      eventIds.push(
        await recordEvent(
          t,
          { type: 'PlaceClaimRejected', actorId: actor!.id, payload: claimFact(other, place) },
          { now },
        ),
      );
    return eventIds;
  });
}

/** An admin turns a claim down, with a note the claimant reads. Returns the event to dispatch. */
export async function rejectClaim(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  { note }: { note: string },
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const { claim, place } = await waitingClaim(t, id);
    await t
      .update(placeClaims)
      .set({
        status: 'rejected',
        decidedBy: actor!.id,
        decidedAt: now,
        decisionNote: note.trim() || null,
        updatedAt: now,
      })
      .where(eq(placeClaims.id, claim.id));
    return [
      await recordEvent(
        t,
        { type: 'PlaceClaimRejected', actorId: actor!.id, payload: claimFact(claim, place) },
        { now },
      ),
    ];
  });
}

/**
 * The place loses its owner: they hand it back ("Deixar de gerenciar"), or an admin takes them
 * off. Its edits go through review again from then. Refused when it has no owner
 * (`not_owned`). Returns the event to dispatch.
 */
export async function removePlaceOwner(
  db: AnyDb,
  actor: Actor | null,
  placeId: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [place] = await t
      .select()
      .from(places)
      .where(and(eq(places.id, placeId), isNull(places.removedAt)))
      .for('update');
    if (!place) throw new NotFound(`no place "${placeId}"`);
    authorize(actor, 'place:release', place);
    if (!place.ownerId) throw new Invalid('id', 'not_owned');

    await t.update(places).set({ ownerId: null, ownerSince: null }).where(eq(places.id, place.id));
    return [
      await recordEvent(
        t,
        {
          type: 'PlaceOwnerRemoved',
          actorId: actor!.id,
          payload: {
            placeId: place.id,
            slug: place.slug,
            name: place.name,
            profileId: place.ownerId,
          },
        },
        { now },
      ),
    ];
  });
}
