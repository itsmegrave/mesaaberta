import * as Sentry from '@sentry/sveltekit';
import { sequence, type Handle, type HandleServerError } from '@sveltejs/kit/hooks';
import {
  createFlags,
  flagOverrides,
  shouldForceAllFlags,
} from '@mesaaberta/core/server/flags/flags';
import { growthBookPayload } from '@mesaaberta/core/server/flags/payload';
import { handleCanonicalRoutes } from '#lib/server/canonical-routes.js';
import { handleAuth } from '#lib/server/auth/handle-auth.js';
import { handleSuspended } from '#lib/server/auth/suspended.js';
import { can } from '@mesaaberta/core/server/auth/policy';
import { handleDatabase } from '#lib/server/db/handle-database.js';
import { logger, setTelemetrySink } from '@mesaaberta/core/server/logger';
import { sentrySink } from '#lib/server/sentry-sink.js';
import { handleRequestLog, handleUserTag } from '#lib/server/request-log.js';
import { handleHostTelemetry, handleRuntime } from '#lib/server/runtime.js';
import { createTracker } from '@mesaaberta/core/server/analytics/track';
import { analyticsHandlers, type AnalyticsEnv } from '@mesaaberta/core/server/analytics/index';
import { MAIL_HANDLER_NAMES, bellHandlers } from '@mesaaberta/core/server/events/handlers';
import { handleMaintenance } from '#lib/server/maintenance.js';
import { handleAdminAccess } from '#lib/server/admin-access.js';
import { handleSecurityHeaders } from '#lib/server/security-headers.js';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';

// The logger knows no vendor; this deployment mirrors it to Sentry. Set at module load, so every
// request in the isolate reports as before.
setTelemetrySink(sentrySink);

const handleParaglide: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    // SvelteKit exposes `request` as read-only; retain Paraglide's request context for translations.
    (event as { request: Request }).request = request;

    return resolve(event, {
      transformPageChunk: ({ html }) =>
        html
          .replace('%paraglide.lang%', locale)
          .replace('%paraglide.dir%', getTextDirection(locale)),
    });
  });

// Product events for signed-in people, sent after the response (needs `afterResponse`, so it follows handleDatabase).
const handleAnalytics: Handle = ({ event, resolve }) => {
  event.locals.track = createTracker({
    env: event.locals.env as AnalyticsEnv | undefined,
    afterResponse: (task) => event.locals.afterResponse((db) => task(db)),
    log: event.locals.log,
  });
  return resolve(event);
};

// Flags load lazily: nothing is fetched unless a route reads one. Without the GrowthBook
// settings (for example plain `vite dev`), every flag returns its default.
const handleFlags: Handle = ({ event, resolve }) => {
  const env = event.locals.env;
  const { cache, waitUntil } = event.locals.host;
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
          cache,
          waitUntil: (promise) => waitUntil?.(promise),
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

  // The same targeting, read the first time an event is dispatched and only when a queue is bound.
  let shadow: Promise<boolean> | undefined;

  event.locals.queueShadow = () =>
    (shadow ??= (async () => {
      const profile = await event.locals.getProfile().catch(() => null);

      return event.locals.flags.isEnabled(
        'api_events_queue_shadow',
        profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
      );
    })());

  // Stage 3: the handler classes this request hands to the queue, one flag per class, for the
  // people each flag targets. Read like the two above.
  let live: Promise<readonly string[]> | undefined;

  event.locals.queueLive = () =>
    (live ??= (async () => {
      const profile = await event.locals.getProfile().catch(() => null);
      const target = profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {};
      const [analytics, bell, mail] = await Promise.all([
        event.locals.flags.isEnabled('api_events_queue_analytics', target),
        event.locals.flags.isEnabled('api_events_queue_bell', target),
        event.locals.flags.isEnabled('api_events_queue_mail', target),
      ]);
      return [
        ...(analytics ? analyticsHandlers(env as AnalyticsEnv | undefined) : []),
        ...(bell ? bellHandlers : []),
      ]
        .map(({ name }) => name)
        .concat(mail ? MAIL_HANDLER_NAMES : []);
    })());

  return resolve(event);
};

// Security headers go first so they wrap every response, including the ones later hooks produce.
export const handle: Handle = sequence(
  // The host's own set-up of error reporting, around everything else.
  handleHostTelemetry,
  Sentry.sentryHandle(),
  handleSecurityHeaders,
  // Before anything that reads configuration.
  handleRuntime,
  handleRequestLog(logger),
  handleDatabase,
  handleAnalytics,
  handleAuth,
  handleUserTag,
  handleSuspended,
  handleAdminAccess,
  handleCanonicalRoutes,
  handleParaglide,
  handleFlags,
  // Needs the flags and the signed-in profile, so it comes after both.
  handleMaintenance,
);

// Replaces SvelteKit's default console output so an unexpected error carries the request id.
// A 404 is a visitor's typo, not a fault, and the request line already records it.
export const handleError: HandleServerError = Sentry.handleErrorWithSentry((input) => {
  // SvelteKit 3 calls this for every error, the ones thrown with `error()` and the 404s it makes
  // itself included: only what nobody meant to happen (an unknown error, or a 5xx) is a fault.
  const status = input.kind === 'unknown' ? 500 : input.error.status;
  if (input.kind === 'unknown' || status >= 500)
    (input.event.locals.log ?? logger).error('unhandled error', { error: input.error, status });
});
