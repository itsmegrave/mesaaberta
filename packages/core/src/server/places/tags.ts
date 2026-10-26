import { eq } from 'drizzle-orm';
import { placeTags, type TaggedPlace } from '../../places/tags';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { placeTags as placeTagsTable } from '@mesaaberta/core/server/db/schema';

/**
 * Replaces a place's tags with the ones its fields give now (`placeTags`). Runs inside the
 * caller's transaction, whenever an approved place is approved again or edited without review.
 */
export async function rebuildPlaceTags(t: AnyDb, placeId: string, place: TaggedPlace) {
  await t.delete(placeTagsTable).where(eq(placeTagsTable.placeId, placeId));
  await t.insert(placeTagsTable).values(placeTags(place).map((tag) => ({ placeId, ...tag })));
}

/** Takes a place's tags off, so it leaves the filters while it waits or after it is removed. */
export async function clearPlaceTags(t: AnyDb, placeId: string) {
  await t.delete(placeTagsTable).where(eq(placeTagsTable.placeId, placeId));
}
