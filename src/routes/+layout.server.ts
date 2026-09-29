import { can } from '$lib/server/auth/policy';
import { pictureOf, supabaseUrlOf } from '$lib/server/images';
import { BELL_LIMIT, listNotifications, unreadCount } from '$lib/server/notifications/service';
import { TIMEZONE_COOKIE, viewerTimezone } from '$lib/time/timezone';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, platform, cookies }) => {
  const authEnabled = locals.supabase !== null;
  // The Mesas link appears once the platform is released. The pages exist before that, unlinked.
  const released = await locals.flags.isEnabled('is_platform_released');

  try {
    const profile = await locals.getProfile();
    // The bell: how many are unread, and the latest few for its menu.
    const [unread, latest] =
      profile && locals.db
        ? await Promise.all([
            unreadCount(locals.db, profile.id),
            listNotifications(locals.db, profile.id, { limit: BELL_LIMIT }),
          ])
        : [0, []];

    return {
      authEnabled,
      released,
      // Every time on the site is shown in this zone.
      viewer: viewerTimezone(profile?.timezone, cookies.get(TIMEZONE_COOKIE)),
      account: profile && {
        displayName: profile.name ?? profile.username ?? 'Pessoa sem nome',
        username: profile.username,
        avatarUrl: pictureOf(supabaseUrlOf(platform?.env), profile),
        isAdmin: can(profile, 'admin:access'),
        pendingSuggestionsCount: 0,
        notifications: { unread, latest },
      },
    };
  } catch (error) {
    // The page is still worth showing without the account menu.
    locals.log.error('layout: could not load the profile', { error });
    return {
      authEnabled,
      released,
      viewer: viewerTimezone(null, cookies.get(TIMEZONE_COOKIE)),
      account: null,
    };
  }
};
