import { error } from '@sveltejs/kit';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { publicReadNow } from '@mesaaberta/core/server/reads/now';
import { listPlaces } from '@mesaaberta/core/server/places/directory';
import { readPlaceFilters } from '@mesaaberta/core/places/filters';
import type { RequestEvent } from '@sveltejs/kit';
import { requireDirectory } from '../directories/flags';

/** The `/places` list (Onde jogar): one page of listed places for the filters in the address. */
export const read = async ({ locals, url }: RequestEvent) => {
  await requireDirectory(locals, 'places');
  const filters = readPlaceFilters(url.searchParams);
  // No database yet (see the README): the page still renders, with nothing to list.
  if (!locals.db) return { filters, places: [], total: 0, pages: 1, states: [], cities: [] };

  const list = await listPlaces(locals.db, filters, publicReadNow());
  // A page past the last one does not exist.
  if (!list) error(404, 'Not found');
  const supabase = supabaseUrlOf(locals.env);
  return {
    filters,
    total: list.total,
    pages: list.pages,
    states: list.states,
    cities: list.cities,
    places: list.places.map(({ imagePath, ...place }) => ({
      ...place,
      imageUrl: imageUrl(supabase, imagePath),
    })),
  };
};
