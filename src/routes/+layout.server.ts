import { cannyLinks } from '$lib/canny/links';
import { loadRead } from '$lib/server/reads/load';
import { pendingCount } from '$lib/server/admin/catalog';
import { can } from '$lib/server/auth/policy';
import { pictureOf, supabaseUrlOf } from '$lib/server/images';
import { unreadConversations } from '$lib/server/messages/service';
import { BELL_LIMIT, listNotifications, unreadCount } from '$lib/server/notifications/service';
import { TIMEZONE_COOKIE, viewerTimezone } from '$lib/time/timezone';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  const { locals, platform, cookies, route } = event;
  const authEnabled = locals.supabase !== null;
  const links = cannyLinks(platform?.env);

  // The maintenance screen gets a bare shell: no account, no bell, no navigation into the product.
  if (route.id === '/maintenance') {
    return {
      authEnabled,
      links,
      maintenance: true,
      maintenanceBypass: false,
      viewer: viewerTimezone(null, cookies.get(TIMEZONE_COOKIE)),
      account: null,
      cacheIdentity: 'anonymous',
      accountRead: null,
    };
  }
  // An admin still uses the site while it is down, with a banner saying so.
  const maintenanceBypass = locals.maintenance === 'bypass';

  try {
    const profile = await locals.getProfile();
    const cacheIdentity = (await locals.getUser())?.id ?? 'anonymous';
    const accountRead = await loadRead(event, 'account');
    // The bell: how many are unread, and the latest few for its menu.
    const [unread, latest, messagesUnread] =
      profile && locals.db
        ? await Promise.all([
            unreadCount(locals.db, profile.id),
            listNotifications(locals.db, profile.id, { limit: BELL_LIMIT }),
            unreadConversations(locals.db, profile.id),
          ])
        : [0, [], 0];

    return {
      authEnabled,
      links,
      cacheIdentity,
      accountRead,
      maintenance: false,
      maintenanceBypass,
      // Every time on the site is shown in this zone.
      viewer: viewerTimezone(profile?.timezone, cookies.get(TIMEZONE_COOKIE)),
      account: profile && {
        displayName: profile.name ?? profile.username ?? 'Pessoa sem nome',
        username: profile.username,
        avatarUrl: pictureOf(supabaseUrlOf(platform?.env), profile),
        isAdmin: can(profile, 'admin:access'),
        pendingSuggestionsCount:
          locals.db && can(profile, 'admin:access') ? await pendingCount(locals.db) : 0,
        notifications: { unread, latest },
        messagesUnread,
      },
    };
  } catch (error) {
    // The page is still worth showing without the account menu.
    locals.log.error('layout: could not load the profile', { error });
    return {
      authEnabled,
      links,
      maintenance: false,
      maintenanceBypass,
      viewer: viewerTimezone(null, cookies.get(TIMEZONE_COOKIE)),
      account: null,
      cacheIdentity: 'anonymous',
      accountRead: null,
    };
  }
};
