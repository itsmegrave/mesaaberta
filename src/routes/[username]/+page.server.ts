import { error, redirect } from '@sveltejs/kit';
import { pageNumber } from '$lib/admin/catalog';
import { localizedHref } from '$lib/i18n/locales';
import { getLocale } from '$lib/paraglide/runtime';
import { supabaseUrlOf } from '$lib/server/images';
import { publicProfile } from '$lib/server/profile/public';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, platform, setHeaders, url }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');
  const user = await locals.getUser();
  const data = await publicProfile(locals.db, params.username, {
    page: pageNumber(url.searchParams.get('page')),
    viewerId: user?.id,
    supabaseUrl: supabaseUrlOf(platform?.env),
  });
  if (!data || data.page > data.pages) error(404, 'Not found');
  const path = localizedHref(`/${data.profile.username}`, getLocale());
  if (params.username !== data.profile.username) redirect(308, `${path}${url.search}`);
  return { ...data, canonical: new URL(path, url.origin).href };
};
