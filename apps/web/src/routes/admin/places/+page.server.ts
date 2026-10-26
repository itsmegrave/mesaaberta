import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin-access.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { placeActions } from '#lib/server/moderation/admin-actions.js';
import { listAdminPlaces } from '@mesaaberta/core/server/places/admin';

import type { Actions, PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and the load checks again.
// The queue works with `api_directory_places` off, so places can be reviewed before /places opens.
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');

  const list = await listAdminPlaces(locals.db, await locals.getProfile(), url.searchParams);
  if (!list) error(404, 'Not found');
  const supabase = supabaseUrlOf(locals.env);
  return {
    places: {
      ...list,
      rows: list.rows.map(({ imagePath, ...row }) => ({
        ...row,
        image: imageUrl(supabase, imagePath),
      })),
    },
  };
};

export const actions: Actions = {
  approve: placeActions.approve,
  remove: placeActions.remove,
  restore: placeActions.restore,
};
