import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import type { listPlaces } from '@mesaaberta/core/server/places/directory';
import { readFromApi } from '../api-read';
import { readPlaceFilters } from '@mesaaberta/core/places/filters';
import type { RequestEvent } from '@sveltejs/kit';
import { requireDirectory } from '../directories/flags';
import { placeTagsEnabled } from '../places/tags';

/** The `/places` list (Onde jogar): one page of listed places for the filters in the address. */
export const read = async ({ locals, url }: RequestEvent) => {
  await requireDirectory(locals, 'places');
  const filters = readPlaceFilters(url.searchParams);
  // The api reads the page; one past the last is its 404, which becomes the page's.
  const [list, placeTags] = await Promise.all([
    readFromApi<NonNullable<Awaited<ReturnType<typeof listPlaces>>>>(
      locals,
      (await locals.getUser())?.id ?? null,
      `/v1/reads/places?${url.searchParams}`,
    ),
    placeTagsEnabled(locals),
  ]);
  const supabase = supabaseUrlOf(locals.env);
  return {
    filters,
    total: list.total,
    pages: list.pages,
    states: list.states,
    cities: list.cities,
    tags: list.tags,
    // Off, the Tags filter stays at the six old Comodidades.
    placeTags,
    places: list.places.map(({ imagePath, ...place }) => ({
      ...place,
      imageUrl: imageUrl(supabase, imagePath),
    })),
  };
};
