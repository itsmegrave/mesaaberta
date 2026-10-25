import { error, isRedirect, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireUser } from '#lib/server/auth/guard.js';
import { profiles } from '@mesaaberta/core/server/db/schema';
import { failFrom } from '#lib/server/fail-from.js';
import { openDirectConversation } from '#lib/server/messages/open-direct.js';
import { routes } from '@mesaaberta/core/routes';
import { normalizeUsername } from '@mesaaberta/core/profile/username';
import { pageNumber } from '@mesaaberta/core/admin/catalog';

import { supabaseUrlOf } from '@mesaaberta/core/server/images';
import { publicProfile } from '@mesaaberta/core/server/profile/public';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, setHeaders, url }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');
  const user = await locals.getUser();
  const data = await publicProfile(locals.db, params.username, {
    page: pageNumber(url.searchParams.get('page')),
    viewerId: user?.id,
    supabaseUrl: supabaseUrlOf(locals.env),
    // The rollout is by the profile, so everyone sees the same strip on a given profile.
    showBadges: (target) => locals.flags.isEnabled('api_badges', target),
  });
  if (!data || data.page > data.pages) error(404, 'Not found');
  const path = routes.profile(data.profile.username);
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
      const conversationId = await openDirectConversation(
        locals,
        await locals.getProfile(),
        target.id,
      );
      redirect(303, `/m/${conversationId}`);
    } catch (cause) {
      if (isRedirect(cause)) throw cause;
      return failFrom(cause);
    }
  },
};
