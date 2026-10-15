import { cannyLinks } from '$lib/canny/links';
import { siteOf } from '@mesaaberta/core/server/site';
import { loadRead } from '$lib/server/reads/load';
import { pendingCount } from '@mesaaberta/core/server/admin/catalog';
import { can } from '@mesaaberta/core/server/auth/policy';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { unreadConversations } from '@mesaaberta/core/server/messages/service';
import {
  BELL_LIMIT,
  listNotifications,
  unreadCount,
} from '@mesaaberta/core/server/notifications/service';
import { TIMEZONE_COOKIE, viewerTimezone } from '@mesaaberta/core/time/timezone';
import type { LayoutServerLoad } from './$types';

/**
 * postgres.js raises CONNECTION_ENDED only for a query submitted after this request's own `end()`
 * (see handleDatabase): the page's load already decided the response (a redirect, a 404) and this
 * layout load was still going. Nobody sees the account menu then, and the database is fine.
 */
const requestAlreadyEnded = (error: unknown) =>
  [error, (error as { cause?: unknown } | null)?.cause].some(
    (candidate) => (candidate as { code?: unknown } | null)?.code === 'CONNECTION_ENDED',
  );

export const load: LayoutServerLoad = async (event) => {
  const { locals, cookies, route } = event;
  const authEnabled = locals.supabase !== null;
  const links = cannyLinks(locals.env);
  const site = siteOf(locals.env, locals.log);

  // The maintenance screen gets a bare shell: no account, no bell, no navigation into the product.
  if (route.id === '/maintenance') {
    return {
      authEnabled,
      links,
      site,
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
      site,
      cacheIdentity,
      accountRead,
      maintenance: false,
      maintenanceBypass,
      // Every time on the site is shown in this zone.
      viewer: viewerTimezone(profile?.timezone, cookies.get(TIMEZONE_COOKIE)),
      account: profile && {
        displayName: profile.name ?? profile.username ?? 'Pessoa sem nome',
        username: profile.username,
        avatarUrl: pictureOf(supabaseUrlOf(locals.env), profile),
        isAdmin: can(profile, 'admin:access'),
        pendingSuggestionsCount:
          locals.db && can(profile, 'admin:access') ? await pendingCount(locals.db) : 0,
        notifications: { unread, latest },
        messagesUnread,
      },
    };
  } catch (error) {
    // The page is still worth showing without the account menu.
    if (requestAlreadyEnded(error))
      locals.log.info('layout: the request ended before the account menu loaded');
    else locals.log.error('layout: could not load the profile', { error });
    return {
      authEnabled,
      links,
      site,
      maintenance: false,
      maintenanceBypass,
      viewer: viewerTimezone(null, cookies.get(TIMEZONE_COOKIE)),
      account: null,
      cacheIdentity: 'anonymous',
      accountRead: null,
    };
  }
};
