import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { areaOf } from '../../location/cep';
import type { PlaceKind } from '../../places/types';
import type { TableInput } from '../../tables/schema';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { places } from '@mesaaberta/core/server/db/schema';
import { Invalid } from '@mesaaberta/core/server/errors';

// Picking an "Onde jogar" place for an in-person table: the places a GM may pick, and what a
// picked one copies into the table (its CEP and area), so the table filters work as with a CEP.

const listed = and(isNotNull(places.approvedAt), isNull(places.removedAt), isNull(places.hiddenAt));

/** The places the table form offers, by name: only listed ones (approved, not hidden or removed). */
export async function placeOptions(db: AnyDb) {
  const rows = await db
    .select({
      slug: places.slug,
      name: places.name,
      kind: places.kind,
      neighbourhood: places.neighbourhood,
      city: places.city,
      state: places.state,
    })
    .from(places)
    .where(listed)
    .orderBy(asc(places.name), asc(places.slug));
  return rows.map((row) => ({ ...row, kind: row.kind as PlaceKind }));
}

export type PlaceOption = Awaited<ReturnType<typeof placeOptions>>[number];

/** The slug of a table's place, for the edit and duplicate forms; null when it has none or it is gone. */
export async function placeSlugOf(db: AnyDb, placeId: string | null): Promise<string> {
  if (!placeId) return '';
  const [row] = await db
    .select({ slug: places.slug })
    .from(places)
    .where(and(eq(places.id, placeId), isNull(places.removedAt)));
  return row?.slug ?? '';
}

/**
 * An in-person table set at a listed place: the place's id, CEP, neighbourhood, city, state and
 * public area replace what the form typed (the private "Como chegar" stays). Online, or with no
 * place picked, the input comes back as it was. A place that is not listed is refused on
 * `placeSlug`.
 */
export async function withPlace(db: AnyDb, input: TableInput, slug: string): Promise<TableInput> {
  if (input.modality !== 'in_person' || !slug) return { ...input, placeId: null };
  const [place] = await db
    .select()
    .from(places)
    .where(and(eq(places.slug, slug), listed));
  if (!place) throw new Invalid('placeSlug', 'not_found');
  return {
    ...input,
    placeId: place.id,
    postalCode: place.postalCode,
    locationArea: areaOf(place),
    locationNeighbourhood: place.neighbourhood,
    locationCity: place.city,
    locationState: place.state,
  };
}

/**
 * Refuses a place a table may not newly point at: unknown, waiting, hidden or removed. A table that
 * keeps the place it already had is not checked again, so editing it never fails because its place
 * was hidden meanwhile.
 */
export async function checkTablePlace(db: AnyDb, placeId: string | null, current: string | null) {
  if (!placeId || placeId === current) return;
  const [place] = await db
    .select({ id: places.id })
    .from(places)
    .where(and(eq(places.id, placeId), listed));
  if (!place) throw new Invalid('placeSlug', 'not_found');
}

/** What a table's page shows of its place: only while the place is listed, null otherwise. */
export async function tablePlace(db: AnyDb, placeId: string) {
  const [place] = await db
    .select({
      slug: places.slug,
      name: places.name,
      kind: places.kind,
      street: places.street,
      complement: places.complement,
      neighbourhood: places.neighbourhood,
      city: places.city,
      state: places.state,
      postalCode: places.postalCode,
    })
    .from(places)
    .where(and(eq(places.id, placeId), listed));
  return place ? { ...place, kind: place.kind as PlaceKind } : null;
}
