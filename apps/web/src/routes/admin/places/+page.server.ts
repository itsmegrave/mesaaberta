import { requireAdmin } from '#lib/server/admin-access.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { placeActions } from '#lib/server/moderation/admin-actions.js';
import type { listAdminPlaces } from '@mesaaberta/core/server/places/admin';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';

import type { Actions, PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and the load checks again.
// The queue works with `api_directory_places` off, so places can be reviewed before /places opens.
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  const user = await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });

  // A page past the last is the api's 404, which becomes the page's.
  const list = revivedDates(
    await readFromApi<NonNullable<Awaited<ReturnType<typeof listAdminPlaces>>>>(
      locals,
      user.id,
      `/v1/admin-reads/places?${url.searchParams}`,
    ),
  );
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
  removeOwner: placeActions.removeOwner,
};
