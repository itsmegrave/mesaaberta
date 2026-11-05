import { siteOf } from '@mesaaberta/core/server/site';
import { loadRead } from '#lib/server/reads/load.js';
import { can } from '@mesaaberta/core/server/auth/policy';
import { badgesEnabled } from '#lib/server/badges/enabled.js';
import { NO_DIRECTORIES, directoryFlags } from '#lib/server/directories/flags.js';
import { beginnersEnabled } from '#lib/server/tables/beginners.js';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { readShell } from '#lib/server/me.js';
import { TIMEZONE_COOKIE, viewerTimezone } from '@mesaaberta/core/time/timezone';
import { isPublished } from '#lib/blog.js';
import { posts } from '#lib/server/blog.js';
import type { LayoutServerLoad } from './$types';

/**
 * The account menu while the api cannot read the profile: the name Supabase holds and nothing the
 * api would have counted. `unavailable` lets the shell keep the full account it showed last.
 */
const unavailableAccount = (user: { user_metadata?: Record<string, unknown> }) => {
  const metadata = user.user_metadata ?? {};
  const name = [metadata.full_name, metadata.name].find(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  );
  return {
    displayName: name?.trim() ?? 'Pessoa sem nome',
    username: null as string | null,
    avatarUrl: null as string | null,
    isAdmin: false,
    pendingSuggestionsCount: 0,
    notifications: { unread: 0, latest: [], seenAt: new Date().toISOString() },
    messagesUnread: 0,
    unavailable: true as const,
  };
};

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
      beginners: false,
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
      // Iniciantes: the mark on table cards and pages, and the guide's links.
      beginners: await beginnersEnabled(locals),
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
    // The page is still worth showing. Someone whose session Supabase just verified stays signed
    // in: only the api's read of their profile failed, and a header with "Entrar" (and a cleared
    // client cache) would look like being signed out on every link they follow until it answers.
    locals.log.error('layout.profile_load_failed', { error });
    const user = await locals.getUser().catch(() => null);
    return {
      authEnabled,
      site,
      blogLive,
      maintenance: false,
      maintenanceBypass,
      viewer: viewerTimezone(null, cookies.get(TIMEZONE_COOKIE)),
      account: user && unavailableAccount(user),
      cacheIdentity: user?.id ?? 'anonymous',
      accountRead: null,
      directories: NO_DIRECTORIES,
      beginners: false,
    };
  }
};
