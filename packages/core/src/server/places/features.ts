import { and, asc, count, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { slugify } from '../../slug';
import { NEW_CATALOG_PREFIX, SUGGESTION_NAME } from '../../tables/catalog';
import { LEGACY_FEATURE_SLUGS, MAX_PLACE_FEATURES, type PlaceFeature } from '../../places/features';
import type { AnyDb } from '../db/client';
import { placeFeaturePicks, placeFeatures, places } from '../db/schema';
import { Invalid } from '../errors';
import { CATALOG_SUGGESTION_LIMIT } from '../catalog';

// The catalog of a place's tags (`place_features`): what the form offers, what a place picked, and
// the suggestions a member makes from the form. It works like the tables' tags (`../catalog`): an
// approved entry is for everyone; a pending one only for whoever suggested it, and it shows on a
// place's page only once an admin approves it.

const asFeature = ({ name, slug, status }: { name: string; slug: string; status: string }) =>
  status === 'pending' ? { name, slug, pending: true as const } : { name, slug };

/**
 * What the place form offers, in catalog order: the approved entries and, with `suggestedBy`, that
 * person's own pending suggestions. `legacyOnly` keeps it to the old Comodidades (while
 * `use_place_tags` is off), with no suggestions.
 */
export async function listFeatureOptions(
  db: AnyDb,
  { suggestedBy, legacyOnly = false }: { suggestedBy?: string; legacyOnly?: boolean } = {},
): Promise<PlaceFeature[]> {
  const rows = await db
    .select({ name: placeFeatures.name, slug: placeFeatures.slug, status: placeFeatures.status })
    .from(placeFeatures)
    .where(
      legacyOnly
        ? and(
            eq(placeFeatures.status, 'approved'),
            inArray(placeFeatures.slug, [...LEGACY_FEATURE_SLUGS]),
          )
        : suggestedBy
          ? or(
              eq(placeFeatures.status, 'approved'),
              and(eq(placeFeatures.status, 'pending'), eq(placeFeatures.suggestedBy, suggestedBy)),
            )
          : eq(placeFeatures.status, 'approved'),
    )
    .orderBy(asc(placeFeatures.position), asc(placeFeatures.name));
  return rows.map(asFeature);
}

/**
 * The entry a member's new term stands for: the catalog's own when it has the term (approved, or
 * pending from whoever suggested it first), or a new pending suggestion by them. A term the
 * moderation turned down or took out cannot come back this way. Each person holds at most
 * CATALOG_SUGGESTION_LIMIT suggestions waiting.
 */
async function suggestionId(db: AnyDb, typed: string, by: string): Promise<string> {
  const name = typed.trim().replace(/\s+/g, ' ');
  const slug = slugify(name, { fallback: '' });
  if (name.length < SUGGESTION_NAME.min || name.length > SUGGESTION_NAME.max || !slug) {
    throw new Invalid('tags', 'suggestion_invalid');
  }
  const [existing] = await db
    .select({ id: placeFeatures.id, status: placeFeatures.status })
    .from(placeFeatures)
    .where(eq(placeFeatures.slug, slug));
  if (existing) {
    if (existing.status === 'approved' || existing.status === 'pending') return existing.id;
    throw new Invalid('tags', 'suggestion_unavailable');
  }
  // The lock (held to the commit) makes two saves at once count each other.
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`place-feature-suggestion:${by}`}))`,
  );
  const [{ waiting }] = await db
    .select({ waiting: count() })
    .from(placeFeatures)
    .where(and(eq(placeFeatures.suggestedBy, by), eq(placeFeatures.status, 'pending')));
  if (waiting >= CATALOG_SUGGESTION_LIMIT) throw new Invalid('tags', 'suggestion_limit');
  const [created] = await db
    .insert(placeFeatures)
    .values({ name, slug, status: 'pending', suggestedBy: by })
    .returning({ id: placeFeatures.id });
  return created.id;
}

/**
 * Replaces a place's tags with the ones picked, in the order picked, inside the caller's
 * transaction. A pick is an approved entry's slug, a pending one the actor suggested or the place
 * already has, or a new term (`new:<name>`), saved as the actor's suggestion. Anything else, or
 * more than MAX_PLACE_FEATURES, throws `Invalid` on `tags`. Returns the slugs it stored.
 */
export async function setPlaceFeatures(
  db: AnyDb,
  placeId: string,
  actorId: string,
  picks: readonly string[],
): Promise<string[]> {
  const unique = [...new Set(picks)];
  if (unique.length > MAX_PLACE_FEATURES) throw new Invalid('tags', 'too_many');
  const slugs = unique.filter((pick) => !pick.startsWith(NEW_CATALOG_PREFIX));
  const bySlug = new Map<string, string>();
  if (slugs.length > 0) {
    const pickedHere = db
      .select({ id: placeFeaturePicks.featureId })
      .from(placeFeaturePicks)
      .where(eq(placeFeaturePicks.placeId, placeId));
    const rows = await db
      .select({ id: placeFeatures.id, slug: placeFeatures.slug })
      .from(placeFeatures)
      .where(
        and(
          inArray(placeFeatures.slug, slugs),
          or(
            eq(placeFeatures.status, 'approved'),
            // A place keeps an entry an admin took out of the list, or one still waiting, once it has it.
            and(
              inArray(placeFeatures.status, ['pending', 'disabled']),
              inArray(placeFeatures.id, pickedHere),
            ),
            and(eq(placeFeatures.status, 'pending'), eq(placeFeatures.suggestedBy, actorId)),
          ),
        ),
      );
    for (const row of rows) bySlug.set(row.slug, row.id);
    if (slugs.some((slug) => !bySlug.has(slug))) throw new Invalid('tags', 'invalid');
  }

  const ids: string[] = [];
  for (const pick of unique) {
    ids.push(
      pick.startsWith(NEW_CATALOG_PREFIX)
        ? await suggestionId(db, pick.slice(NEW_CATALOG_PREFIX.length), actorId)
        : bySlug.get(pick)!,
    );
  }
  // A new term may turn out to be one already picked.
  const featureIds = [...new Set(ids)];
  await db.delete(placeFeaturePicks).where(eq(placeFeaturePicks.placeId, placeId));
  if (featureIds.length === 0) return [];
  await db
    .insert(placeFeaturePicks)
    .values(featureIds.map((featureId, position) => ({ placeId, featureId, position })));
  const stored = await db
    .select({ id: placeFeatures.id, slug: placeFeatures.slug })
    .from(placeFeatures)
    .where(inArray(placeFeatures.id, featureIds));
  const slugOf = new Map(stored.map((row) => [row.id, row.slug]));
  return featureIds.map((id) => slugOf.get(id)!);
}

/**
 * The tags each place picked, in its order, keyed by place id: the approved ones (and the ones an
 * admin took out of the list since, which places that have them keep), and with `withPending`
 * (the page of someone who may edit it, or its form) the pending ones too, marked.
 */
export async function featuresOf(
  db: AnyDb,
  placeIds: readonly string[],
  { withPending = false }: { withPending?: boolean } = {},
): Promise<Map<string, PlaceFeature[]>> {
  const result = new Map(placeIds.map((id) => [id, [] as PlaceFeature[]]));
  if (placeIds.length === 0) return result;
  const rows = await db
    .select({
      placeId: placeFeaturePicks.placeId,
      name: placeFeatures.name,
      slug: placeFeatures.slug,
      status: placeFeatures.status,
    })
    .from(placeFeaturePicks)
    .innerJoin(placeFeatures, eq(placeFeatures.id, placeFeaturePicks.featureId))
    .where(
      and(
        inArray(placeFeaturePicks.placeId, [...placeIds]),
        inArray(
          placeFeatures.status,
          withPending ? ['approved', 'disabled', 'pending'] : ['approved', 'disabled'],
        ),
      ),
    )
    .orderBy(asc(placeFeaturePicks.position));
  for (const { placeId, ...feature } of rows) result.get(placeId)!.push(asFeature(feature));
  return result;
}

/** The ids of the listed places that picked a catalog entry, for its tags to be rebuilt. */
export async function listedPlacesPicking(db: AnyDb, featureId: string): Promise<string[]> {
  const rows = await db
    .select({ id: places.id })
    .from(placeFeaturePicks)
    .innerJoin(places, eq(places.id, placeFeaturePicks.placeId))
    .where(
      and(
        eq(placeFeaturePicks.featureId, featureId),
        isNotNull(places.approvedAt),
        isNull(places.removedAt),
      ),
    );
  return rows.map((row) => row.id);
}
