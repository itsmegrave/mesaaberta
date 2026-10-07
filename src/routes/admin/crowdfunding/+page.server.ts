import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin-access';
import { requireUser } from '$lib/server/auth/guard';
import { listAdminCrowdfundings } from '$lib/server/crowdfunding/admin';
import { imageUrl, supabaseUrlOf } from '$lib/server/images';
import { crowdfundingActions } from '$lib/server/moderation/admin-actions';
import type { Actions, PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and the load checks again.
export const load: PageServerLoad = async ({ locals, url, setHeaders, platform }) => {
  await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');

  const list = await listAdminCrowdfundings(locals.db, await locals.getProfile(), url.searchParams);
  if (!list) error(404, 'Not found');
  const supabase = supabaseUrlOf(platform?.env);
  return {
    crowdfundings: {
      ...list,
      rows: list.rows.map(({ imagePath, ...row }) => ({
        ...row,
        cover: imageUrl(supabase, imagePath),
      })),
    },
  };
};

export const actions: Actions = { remove: crowdfundingActions.remove };
