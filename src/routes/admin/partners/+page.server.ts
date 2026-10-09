import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin-access';
import { requireUser } from '$lib/server/auth/guard';
import { partnerLogoUrl, supabaseUrlOf } from '$lib/server/images';
import { partnerActions } from '$lib/server/moderation/admin-actions';
import { listAdminPartners } from '$lib/server/partners/admin';

import type { Actions, PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and the load checks again.
export const load: PageServerLoad = async ({ locals, url, setHeaders, platform }) => {
  await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');

  const list = await listAdminPartners(locals.db, await locals.getProfile(), url.searchParams);
  if (!list) error(404, 'Not found');
  const supabase = supabaseUrlOf(platform?.env);
  return {
    partners: {
      ...list,
      rows: list.rows.map(({ logoPath, ...row }) => ({
        ...row,
        logo: partnerLogoUrl(supabase, logoPath),
      })),
    },
  };
};

export const actions: Actions = { approve: partnerActions.approve, remove: partnerActions.remove };
