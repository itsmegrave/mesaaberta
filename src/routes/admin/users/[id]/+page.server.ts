import { error, isRedirect, redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin-access';
import { adminActivity, adminProfile } from '$lib/server/admin/profiles';
import { profileHistory } from '$lib/server/admin/history';
import { failFrom } from '$lib/server/fail-from';
import { openDirect } from '$lib/server/messages/service';
import { standingOf } from '$lib/profile/standing';
import { moderationOf } from '$lib/server/moderation/admin';
import { accountActions } from '$lib/server/moderation/admin-actions';
import { pictureOf, supabaseUrlOf } from '$lib/server/images';
import { profileFilters } from '$lib/admin/profile-filters';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, platform, setHeaders, url }) => {
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
    avatar: pictureOf(supabaseUrlOf(platform?.env), { avatarPath, avatarUrl }),
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
      const conversation = await openDirect(locals.db, await locals.getProfile(), params.id);
      redirect(303, `/messages/${conversation.id}`);
    } catch (cause) {
      if (isRedirect(cause)) throw cause;
      return failFrom(cause);
    }
  },
};
