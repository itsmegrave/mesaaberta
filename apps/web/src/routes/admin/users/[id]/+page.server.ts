import { error, isRedirect, redirect } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin-access.js';
import type { adminActivity, adminProfile } from '@mesaaberta/core/server/admin/profiles';
import type { profileHistory } from '@mesaaberta/core/server/admin/history';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import { failFrom } from '#lib/server/fail-from.js';
import { openAdminConversation, openDirectConversation } from '#lib/server/messages/open-direct.js';
import { standingOf } from '@mesaaberta/core/profile/standing';
import type { moderationOf } from '@mesaaberta/core/server/moderation/admin';
import { accountActions, badgeActions } from '#lib/server/moderation/admin-actions.js';
import type { adminBadgesOf } from '@mesaaberta/core/server/badges/admin';
import { badgesEnabled } from '#lib/server/badges/enabled.js';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { profileFilters } from '@mesaaberta/core/admin/profile-filters';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, setHeaders, url }) => {
  const viewer = await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id))
    error(404, 'Not found');
  // What the person holds and had taken away, while badges are on (`use_badges` is the switch).
  const withBadges = await badgesEnabled(locals, viewer);
  // An unknown person is the api's 404, which becomes the page's.
  const { profile, activity, history, moderation, badges } = revivedDates(
    await readFromApi<{
      profile: NonNullable<Awaited<ReturnType<typeof adminProfile>>>;
      activity: Awaited<ReturnType<typeof adminActivity>>;
      history: Awaited<ReturnType<typeof profileHistory>>;
      moderation: NonNullable<Awaited<ReturnType<typeof moderationOf>>>;
      badges: Awaited<ReturnType<typeof adminBadgesOf>> | null;
    }>(locals, viewer.id, `/v1/admin-reads/users/${encodeURIComponent(params.id)}${withBadges ? '?badges=1' : ''}`),
  );
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
    activity,
    history,
    badges,
    avatar: pictureOf(supabaseUrlOf(locals.env), { avatarPath, avatarUrl }),
    // Ban or revoke (never oneself, another admin, or a closed account), the ban itself, and the
    // reports accepted against the tables they run.
    moderation,
    back: `/admin/users?${back}#profiles`,
  };
};

export const actions: Actions = {
  ...accountActions,
  ...badgeActions,

  // "Mandar mensagem": the admin conversation with this person ("[Admin] @username"), apart from
  // any everyday direct one. It is also where the admin lists post (`personMessages`). With
  // `use_admin_messages` off, the everyday direct conversation, as before.
  message: async ({ locals, params }) => {
    const admin = await requireAdmin(locals);
    try {
      const asAdmin = await locals.flags.isEnabled('use_admin_messages', {
        id: admin.id,
        isAdmin: true,
      });
      const conversationId = asAdmin
        ? await openAdminConversation(locals, admin, params.id)
        : await openDirectConversation(locals, admin, params.id);
      redirect(303, `/m/${conversationId}`);
    } catch (cause) {
      if (isRedirect(cause)) throw cause;
      return failFrom(cause);
    }
  },
};
