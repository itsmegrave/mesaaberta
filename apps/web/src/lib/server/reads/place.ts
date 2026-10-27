import { error, isHttpError } from '@sveltejs/kit';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import type { readPlacePage } from '@mesaaberta/core/server/places/directory';
import { readFromApi, revivedDates } from '../api-read';
import type { RequestEvent } from '@sveltejs/kit';
import { requireDirectory } from '../directories/flags';

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
    locals.log.info('place not found', { code: 'place_not_found' });
    error(404, 'Not found');
  }

  const supabase = supabaseUrlOf(locals.env);
  const { imagePath, ...place } = found.place;
  return {
    ...found,
    place: { ...place, imageUrl: imageUrl(supabase, imagePath) },
    tables: found.tables.map(({ imagePath: tableImage, ...table }) => ({
      ...table,
      imageUrl: imageUrl(supabase, tableImage),
    })),
  };
};
