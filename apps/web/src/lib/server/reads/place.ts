import { error } from '@sveltejs/kit';
import { can } from '@mesaaberta/core/server/auth/policy';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { readPlacePage } from '@mesaaberta/core/server/places/directory';
import type { RequestEvent } from '@sveltejs/kit';
import { requireDirectory } from '../directories/flags';

/**
 * The page of one place (`/pp/[slug]`). A place that waits for review or is hidden opens only for
 * whoever sent it, owns it or moderates; for anyone else, as for a removed one, it is not found.
 */
export const read = async ({ locals, params }: RequestEvent) => {
  await requireDirectory(locals, 'places');
  if (!locals.db) error(503, 'Database not configured');
  const profile = await locals.getProfile();
  const viewer = profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : null;
  const found = await readPlacePage(locals.db, params.slug ?? '', viewer, new Date());
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
