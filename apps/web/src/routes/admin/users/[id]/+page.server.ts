import { error, isRedirect, redirect } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin-access.js';
import { adminActivity, adminProfile } from '@mesaaberta/core/server/admin/profiles';
import { profileHistory } from '@mesaaberta/core/server/admin/history';
import { failFrom } from '#lib/server/fail-from.js';
import { openDirectConversation } from '#lib/server/messages/open-direct.js';
import { standingOf } from '@mesaaberta/core/profile/standing';
import { moderationOf } from '@mesaaberta/core/server/moderation/admin';
import { accountActions } from '#lib/server/moderation/admin-actions.js';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { profileFilters } from '@mesaaberta/core/admin/profile-filters';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, setHeaders, url }) => {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id))
    error(404, 'Not found');
  if (!locals.db) error(503, 'Database not configured');
  const profile = await adminProfile(locals.db, params.id);
  if (!profile) error(404, 'Not found');
  const { avatarPath, avatarUrl, bannedAt, bannedUntil, ...user } = profile;
  const filters = profileFilters(url.searchParams);
  const back = new URLSearchParams({
    status: filters.status,
    q: filters.query,
    page: String(filters.page),
    size: String(filters.pageSize),
  });
  return {
    user,
    standing: standingOf({ status: user.status, bannedAt, bannedUntil }),
    activity: await adminActivity(locals.db, params.id),
    history: await profileHistory(locals.db, await locals.getProfile(), params.id),
    avatar: pictureOf(supabaseUrlOf(locals.env), { avatarPath, avatarUrl }),
    // Ban or revoke (never oneself, another admin, or a closed account), the ban itself, and the
    // reports accepted against the tables they run.
    moderation: (await moderationOf(locals.db, await locals.getProfile(), params.id))!,
    back: `/admin/users?${back}#profiles`,
  };
};

export const actions: Actions = {
  ...accountActions,

  // "Mandar mensagem": the direct conversation with this person (an admin may write to anyone who
  // takes direct messages).
  message: async ({ locals, params }) => {
    await requireAdmin(locals);
    if (!locals.db) error(503, 'Database not configured');
    try {
      const conversationId = await openDirectConversation(
        locals,
        await locals.getProfile(),
        params.id,
      );
      redirect(303, `/m/${conversationId}`);
    } catch (cause) {
      if (isRedirect(cause)) throw cause;
      return failFrom(cause);
    }
  },
};
