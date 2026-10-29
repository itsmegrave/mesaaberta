import { siteOf } from '@mesaaberta/core/server/site';
import { loadRead } from '#lib/server/reads/load.js';
import { can } from '@mesaaberta/core/server/auth/policy';
import { badgesEnabled } from '#lib/server/badges/enabled.js';
import { NO_DIRECTORIES, directoryFlags } from '#lib/server/directories/flags.js';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { readShell } from '#lib/server/me.js';
import { TIMEZONE_COOKIE, viewerTimezone } from '@mesaaberta/core/time/timezone';
import { isPublished } from '#lib/blog.js';
import { posts } from '#lib/server/blog.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  const { locals, cookies, route } = event;
  const authEnabled = locals.supabase !== null;
  const site = siteOf(locals.env, locals.log);
  // The footer links the blog once a post is out.
  const blogLive = posts.some((post) => isPublished(post));

  // The maintenance screen gets a bare shell: no account, no bell, no navigation into the product.
  if (route.id === '/maintenance') {
    return {
      authEnabled,
      site,
      blogLive,
      maintenance: true,
      maintenanceBypass: false,
      viewer: viewerTimezone(null, cookies.get(TIMEZONE_COOKIE)),
      account: null,
      cacheIdentity: 'anonymous',
      accountRead: null,
      directories: NO_DIRECTORIES,
    };
  }
  // An admin still uses the site while it is down, with a banner saying so.
  const maintenanceBypass = locals.maintenance === 'bypass';

  try {
    const profile = await locals.getProfile();
    const cacheIdentity = (await locals.getUser())?.id ?? 'anonymous';
    const accountRead = await loadRead(event, 'account');
    // The bell: how many are unread, and the latest few for its menu.
    const withAchievements = profile ? await badgesEnabled(locals, profile) : false;
    // The bell, the messages link and an admin's waiting suggestions, from the api Worker.
    const shell = profile ? await readShell(locals, profile.id, withAchievements) : null;

    return {
      authEnabled,
      site,
      blogLive,
      cacheIdentity,
      accountRead,
      // Which directories the menus and the footer link to.
      directories: await directoryFlags(locals),
      maintenance: false,
      maintenanceBypass,
      // Every time on the site is shown in this zone.
      viewer: viewerTimezone(profile?.timezone, cookies.get(TIMEZONE_COOKIE)),
      account: profile && {
        displayName: profile.name ?? profile.username ?? 'Pessoa sem nome',
        username: profile.username,
        avatarUrl: pictureOf(supabaseUrlOf(locals.env), profile),
        isAdmin: can(profile, 'admin:access'),
        pendingSuggestionsCount: shell?.pendingSuggestions ?? 0,
        // When the bell's list was read: "mark all read" leaves what came after it.
        notifications: {
          unread: shell?.unread ?? 0,
          latest: shell?.latest ?? [],
          seenAt: new Date().toISOString(),
        },
        messagesUnread: shell?.messagesUnread ?? 0,
      },
    };
  } catch (error) {
    // The page is still worth showing without the account menu.
    locals.log.error('layout.profile_load_failed', { error });
    return {
      authEnabled,
      site,
      blogLive,
      maintenance: false,
      maintenanceBypass,
      viewer: viewerTimezone(null, cookies.get(TIMEZONE_COOKIE)),
      account: null,
      cacheIdentity: 'anonymous',
      accountRead: null,
      directories: NO_DIRECTORIES,
    };
  }
};
