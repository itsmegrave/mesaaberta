import * as Sentry from '@sentry/sveltekit';
import { sentryOptions } from '$lib/observability/privacy';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { createFlags, flagOverrides, shouldForceAllFlags } from '$lib/server/flags/flags';
import { growthBookPayload, type PayloadCache } from '$lib/server/flags/payload';
import { handleAuth } from '$lib/server/auth/handle-auth';
import { handleSuspended } from '$lib/server/auth/suspended';
import { can } from '$lib/server/auth/policy';
import { handleDatabase } from '$lib/server/db/handle-database';
import { logger } from '$lib/server/logger';
import { handleRequestLog } from '$lib/server/request-log';
import { createTracker } from '$lib/server/analytics/track';
import type { AnalyticsEnv } from '$lib/server/analytics';
import { handleMaintenance } from '$lib/server/maintenance';
import { handleAdminAccess } from '$lib/server/admin-access';
import { handleSecurityHeaders } from '$lib/server/security-headers';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';

const handleParaglide: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request;

    return resolve(event, {
      transformPageChunk: ({ html }) =>
        html
          .replace('%paraglide.lang%', locale)
          .replace('%paraglide.dir%', getTextDirection(locale)),
    });
  });

// Adapts the Workers Cache API to the string store the flags loader expects.
type WorkersCache = App.Platform['caches']['default'];

const workersCache = (cache: WorkersCache): PayloadCache => ({
  get: async (url) => (await cache.match(url))?.text(),
  set: (url, body, ttlSeconds) =>
    cache.put(
      url,
      // The DOM lib and the generated Workers types both declare `Response`. It is the same
      // class in the Workers runtime; only the two type declarations disagree.
      new Response(body, {
        headers: { 'cache-control': `max-age=${ttlSeconds}` },
      }) as unknown as Parameters<WorkersCache['put']>[1],
    ),
});

// Product events for signed-in people, sent after the response (needs `afterResponse`, so it follows handleDatabase).
const handleAnalytics: Handle = ({ event, resolve }) => {
  event.locals.track = createTracker({
    env: event.platform?.env as AnalyticsEnv | undefined,
    afterResponse: (task) => event.locals.afterResponse((db) => task(db)),
    log: event.locals.log,
  });
  return resolve(event);
};

// Flags load lazily: nothing is fetched unless a route reads one. Without the GrowthBook
// settings (for example plain `vite dev`), every flag returns its default.
const handleFlags: Handle = ({ event, resolve }) => {
  const { env, caches, ctx } = event.platform ?? {};
  // Opt-in preview of work that is not released through GrowthBook yet; see `shouldForceAllFlags`.
  const forceAll = shouldForceAllFlags(
    env as { IGNORE_FEATURE_FLAGS_IN_LOCALHOST?: string } | undefined,
    event.url.hostname,
  );
  const overrides = flagOverrides(
    env as { FEATURE_FLAG_OVERRIDES?: string } | undefined,
    event.url.hostname,
  );

  event.locals.flags = createFlags(
    env?.GROWTHBOOK_CLIENT_KEY
      ? growthBookPayload({
          apiHost: env.GROWTHBOOK_API_HOST,
          clientKey: env.GROWTHBOOK_CLIENT_KEY,
          fetch,
          log: event.locals.log,
          cache: caches && workersCache(caches.default),
          waitUntil: (promise) => ctx?.waitUntil(promise),
        })
      : async () => null,
    { forceAll, overrides, log: event.locals.log },
  );

  // Targeted at admins first (`isAdmin = true`). Read the first time an event is dispatched.
  let fenced: Promise<boolean> | undefined;
  event.locals.fencedLeases = () =>
    (fenced ??= (async () => {
      const profile = await event.locals.getProfile().catch(() => null);
      return event.locals.flags.isEnabled(
        'api_events_fenced_leases',
        profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
      );
    })());

  return resolve(event);
};

// Security headers go first so they wrap every response, including the ones later hooks produce.
export const handle: Handle = sequence(
  (args) =>
    Sentry.initCloudflareSentryHandle({
      ...sentryOptions,
      enabled: import.meta.env.PROD && args.event.url.hostname === 'mesaaberta.app',
    })(args),
  Sentry.sentryHandle(),
  handleSecurityHeaders,
  handleRequestLog(logger),
  handleDatabase,
  handleAnalytics,
  handleAuth,
  handleSuspended,
  handleAdminAccess,
  handleParaglide,
  handleFlags,
  // Needs the flags and the signed-in profile, so it comes after both.
  handleMaintenance,
);

// Replaces SvelteKit's default console output so an unexpected error carries the request id.
// A 404 is a visitor's typo, not a fault, and the request line already records it.
export const handleError: HandleServerError = Sentry.handleErrorWithSentry(
  ({ error, event, status }) => {
    if (status !== 404) (event.locals.log ?? logger).error('unhandled error', { error, status });
  },
);
