import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin-access';
import { adminProfile } from '$lib/server/admin/profiles';
import { pictureOf, supabaseUrlOf } from '$lib/server/images';
import { profileFilters } from '$lib/admin/profile-filters';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, platform, setHeaders, url }) => {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id))
    error(404, 'Not found');
  if (!locals.db) error(503, 'Database not configured');
  const profile = await adminProfile(locals.db, params.id);
  if (!profile) error(404, 'Not found');
  const { avatarPath, avatarUrl, ...user } = profile;
  const filters = profileFilters(url.searchParams);
  const back = new URLSearchParams({
    status: filters.status,
    q: filters.query,
    page: String(filters.page),
    size: String(filters.pageSize),
  });
  return {
    user,
    avatar: pictureOf(supabaseUrlOf(platform?.env), { avatarPath, avatarUrl }),
    back: `/admin/users?${back}#profiles`,
  };
};
