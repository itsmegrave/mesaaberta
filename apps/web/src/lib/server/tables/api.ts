import type { placeOptions } from '@mesaaberta/core/server/places/picker';
import type { loadTableForEdit } from '@mesaaberta/core/server/tables/write';
import type { TableInput } from '@mesaaberta/core/tables/schema';
import { readFromApi } from '../api-read';
import { requireApi } from '../api-required';

// The table forms' data from the api Worker (Trello #120): the web Worker reads no database for it.

/** The "Onde jogar" picker: the listed places. */
export const readPlaceOptions = (locals: App.Locals, actorId: string) =>
  readFromApi<Awaited<ReturnType<typeof placeOptions>>>(locals, actorId, '/v1/reads/place-options');

/**
 * A table as its edit form shows it, times in `timezone`. Someone else's is the page's 403 (a
 * concluded one says why), one that is not there its 404.
 */
export const readTableForEdit = (
  locals: App.Locals,
  actorId: string,
  slug: string,
  timezone: string,
) =>
  readFromApi<Awaited<ReturnType<typeof loadTableForEdit>>>(
    locals,
    actorId,
    `/v1/reads/table-edit/${encodeURIComponent(slug)}?tz=${encodeURIComponent(timezone)}`,
  );

/**
 * Tells a limited person before anything is stored: throws `RateLimited` (with when it frees) when
 * they are over the named limit. The write checks again, under a lock.
 */
export async function checkLimitViaApi(
  locals: App.Locals,
  actorId: string,
  name: 'table' | 'draft' | 'crowdfunding' | 'place' | 'placeClaim',
) {
  await requireApi(locals, { id: actorId }, `/v1/me/limits/${name}`);
}

/**
 * Where a table being saved happens, resolved by the api: the picked place (`placeSlug`, empty when
 * none or the places are off) or the typed CEP. Throws `Invalid` on the field the api refused.
 */
export const resolveTableLocation = (
  locals: App.Locals,
  actorId: string,
  input: TableInput,
  placeSlug: string,
) => readFromApi<TableInput>(locals, actorId, '/v1/reads/table-location', { input, placeSlug });
