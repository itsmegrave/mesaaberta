import { eq, inArray } from 'drizzle-orm';
import { placeTags, type TaggedPlace } from '../../places/tags';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { places, placeTags as placeTagsTable } from '@mesaaberta/core/server/db/schema';
import { featuresOf } from './features';

/**
 * Replaces a place's tags with the ones its fields give now (`placeTags`), with the approved
 * catalog entries it picked. Runs inside the caller's transaction, whenever an approved place is
 * approved again or edited without review, and when an admin decides on an entry it picked.
 */
export async function rebuildPlaceTags(
  t: AnyDb,
  placeId: string,
  place: Omit<TaggedPlace, 'features'>,
) {
  const features = (await featuresOf(t, [placeId])).get(placeId) ?? [];
  await t.delete(placeTagsTable).where(eq(placeTagsTable.placeId, placeId));
  await t
    .insert(placeTagsTable)
    .values(placeTags({ ...place, features }).map((tag) => ({ placeId, ...tag })));
}

/** Rebuilds the tags of these places from their rows (an admin decided on an entry they picked). */
export async function rebuildTagsOf(t: AnyDb, placeIds: readonly string[]) {
  if (placeIds.length === 0) return;
  const rows = await t
    .select({
      id: places.id,
      state: places.state,
      city: places.city,
      neighbourhood: places.neighbourhood,
      kind: places.kind,
    })
    .from(places)
    .where(inArray(places.id, [...placeIds]));
  for (const { id, ...place } of rows) await rebuildPlaceTags(t, id, place);
}

/** Takes a place's tags off, so it leaves the filters while it waits or after it is removed. */
export async function clearPlaceTags(t: AnyDb, placeId: string) {
  await t.delete(placeTagsTable).where(eq(placeTagsTable.placeId, placeId));
}
