import { error, isHttpError } from '@sveltejs/kit';
import { imageUrl, pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import type { readPlacePage } from '@mesaaberta/core/server/places/directory';
import { readFromApi, revivedDates } from '../api-read';
import type { RequestEvent } from '@sveltejs/kit';
import { directoryLinksEnabled, requireDirectory } from '../directories/flags';
import { placeTagsEnabled } from '../places/tags';
import { cardRating, contentRatingSymbolShown } from '../tables/safety-enabled';

/**
 * The page of one place (`/pp/[slug]`). A place that waits for review or is hidden opens only for
 * whoever sent it, owns it or moderates; for anyone else, as for a removed one, it is not found.
 */
export const read = async ({ locals, params }: RequestEvent) => {
  await requireDirectory(locals, 'places');
  // The api decides who may see it, from the actor it is named.
  const found = await readFromApi<NonNullable<Awaited<ReturnType<typeof readPlacePage>>>>(
    locals,
    (await locals.getUser())?.id ?? null,
    `/v1/reads/places/${encodeURIComponent(params.slug ?? '')}`,
  )
    .then(revivedDates)
    .catch((cause) => {
      if (isHttpError(cause) && cause.status === 404) return null;
      throw cause;
    });
  if (!found) {
    // The request line already names the place (`resourceType`, `resourceId`).
    locals.log.info('places.not_found', { code: 'place_not_found' });
    error(404, 'Not found');
  }

  const supabase = supabaseUrlOf(locals.env);
  const { imagePath, ...place } = found.place;
  const links = await directoryLinksEnabled(locals);
  return {
    ...found,
    // "Parceiro Mesa Aberta: <nome>", "Quem mestra aqui" and "Sistemas jogados aqui"
    // (`use_directory_links`).
    partner: links ? found.partner : null,
    gms: links
      ? {
          total: found.gms.total,
          people: found.gms.people.map(({ avatarPath, avatarUrl, ...gm }) => ({
            ...gm,
            avatarUrl: pictureOf(supabase, { avatarPath, avatarUrl }),
          })),
        }
      : { total: 0, people: [] },
    systems: links ? found.systems : [],
    // Off, the page shows the old Comodidades apart, as before the catalog.
    placeTags: await placeTagsEnabled(locals),
    place: { ...place, imageUrl: imageUrl(supabase, imagePath) },
    tables: found.tables
      .map(cardRating(await contentRatingSymbolShown(locals, await locals.getProfile())))
      .map(({ imagePath: tableImage, ...table }) => ({
        ...table,
        imageUrl: imageUrl(supabase, tableImage),
      })),
  };
};
