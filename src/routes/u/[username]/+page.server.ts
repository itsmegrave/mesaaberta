import { error, isRedirect, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth/guard';
import { profiles } from '$lib/server/db/schema';
import { failFrom } from '$lib/server/fail-from';
import { openDirect } from '$lib/server/messages/service';
import { normalizeUsername } from '$lib/profile/username';
import { pageNumber } from '$lib/admin/catalog';
import { localizedHref } from '$lib/i18n/locales';
import { getLocale } from '$lib/paraglide/runtime';
import { supabaseUrlOf } from '$lib/server/images';
import { publicProfile } from '$lib/server/profile/public';
import type { Actions, PageServerLoad } from './$types';

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
  const path = localizedHref(`/u/${data.profile.username}`, getLocale());
  if (params.username !== data.profile.username) redirect(308, `${path}${url.search}`);
  // "Ver como visitante": the owner sees the page as anyone else does.
  const previewing = data.isOwner && url.searchParams.get('as') === 'visitor';
  return {
    ...data,
    isOwner: data.isOwner && !previewing,
    previewing,
    canonical: new URL(path, url.origin).href,
  };
};

export const actions: Actions = {
  // "Mandar mensagem": the direct conversation with this person.
  message: async ({ locals, params, url }) => {
    await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');
    const [target] = await locals.db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.username, normalizeUsername(params.username)));
    if (!target) error(404, 'Not found');
    try {
      const conversation = await openDirect(locals.db, await locals.getProfile(), target.id);
      redirect(303, `/messages/${conversation.id}`);
    } catch (cause) {
      if (isRedirect(cause)) throw cause;
      return failFrom(cause);
    }
  },
};
