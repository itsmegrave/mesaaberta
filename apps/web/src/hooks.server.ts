import { AsyncLocalStorage } from 'node:async_hooks';
import { setRequestContextStore } from '@mesaaberta/contracts';
import * as Sentry from '@sentry/sveltekit';
import { sequence, type Handle, type HandleServerError } from '@sveltejs/kit/hooks';
import {
  createFlags,
  flagOverrides,
  shouldForceAllFlags,
} from '@mesaaberta/core/server/flags/flags';
import { extensionFlagDefaults } from '@mesaaberta/core/server/extensions/index';
import { logInstalled } from '@mesaaberta/core/server/extensions/observe';
import { growthBookPayload } from '@mesaaberta/core/server/flags/payload';
import { handleCanonicalRoutes } from '#lib/server/canonical-routes.js';
import { handleAuth } from '#lib/server/auth/handle-auth.js';
import { handleSuspended } from '#lib/server/auth/suspended.js';
import { handleAfterResponse } from '#lib/server/after-response.js';
import { logger, setAppName, setTelemetrySink } from '@mesaaberta/core/server/logger';
import { sentrySink } from '#lib/server/sentry-sink.js';
import { handleRequestLog, handleUserTag } from '#lib/server/request-log.js';
import { handleHostTelemetry, handleRuntime, handleServerTiming } from '#lib/server/runtime.js';
import { handleHttpMetrics } from '#lib/server/http-metrics.js';
import { createTracker } from '@mesaaberta/core/server/analytics/track';
import type { AnalyticsEnv } from '@mesaaberta/core/server/analytics/index';
import { handleMaintenance } from '#lib/server/maintenance.js';
import { handleChangelogNotice } from '#lib/server/changelog-notice.js';
import { handleAdminAccess } from '#lib/server/admin-access.js';
import { handleSecurityHeaders } from '#lib/server/security-headers.js';
import { handleBodyLimit } from '#lib/server/body-limit.js';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';

// The logger knows no vendor; this deployment mirrors it to Sentry. Set at module load, so every
// request in the isolate reports as before.
setTelemetrySink(sentrySink);
setAppName('web');
// Carries the request id to every log line and outbox write of the request (Trello #278).
setRequestContextStore(new AsyncLocalStorage());
logInstalled();

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

// Product events for signed-in people, sent after the response (needs `afterResponse`, so it follows handleAfterResponse).
const handleAnalytics: Handle = ({ event, resolve }) => {
  event.locals.track = createTracker({
    env: event.locals.env as AnalyticsEnv | undefined,
    afterResponse: (task) => event.locals.afterResponse(task),
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
    { forceAll, overrides, extensionFlags: extensionFlagDefaults(), log: event.locals.log },
  );

  return resolve(event);
};

// Sign in as a local persona (`/dev/login?as=gm`). `import.meta.env.DEV` is false in every build, so
// the module is not even in the bundle there; `scripts/check-no-dev-login.ts` fails CI if it is.
const handleDevLogin: Handle = import.meta.env.DEV
  ? async (input) => (await import('#lib/server/dev/dev-login.js')).handleDevLogin(input)
  : ({ event, resolve }) => resolve(event);

// Security headers go first so they wrap every response, including the ones later hooks produce.
export const handle: Handle = sequence(
  // First, so the total covers every other hook.
  handleServerTiming,
  handleHttpMetrics,
  // The host's own set-up of error reporting, around everything else.
  handleHostTelemetry,
  Sentry.sentryHandle(),
  handleSecurityHeaders,
  // Before anything that reads configuration.
  handleRuntime,
  handleRequestLog(logger),
  // Before the actions: an oversized body is refused before anything reads it.
  handleBodyLimit,
  handleAfterResponse,
  handleAnalytics,
  handleAuth,
  // Needs the Supabase client, before anything that reads the signed-in profile.
  handleDevLogin,
  handleUserTag,
  handleSuspended,
  handleAdminAccess,
  handleCanonicalRoutes,
  handleParaglide,
  handleFlags,
  // Needs the flags and the signed-in profile, so it comes after both.
  handleMaintenance,
  // After the response it sends the newest changelog day to the bell, if it has not gone out.
  handleChangelogNotice,
);

// Replaces SvelteKit's default console output so an unexpected error carries the request id.
// A 404 is a visitor's typo, not a fault, and the request line already records it.
const reportError: HandleServerError = Sentry.handleErrorWithSentry((input) => {
  // SvelteKit 3 calls this for every error, the ones thrown with `error()` and the 404s it makes
  // itself included: only what nobody meant to happen (an unknown error, or a 5xx) is a fault.
  const status = input.kind === 'unknown' ? 500 : input.error.status;
  if (input.kind === 'unknown' || status >= 500)
    (input.event.locals.log ?? logger).error('request.unhandled_error', {
      error: input.error,
      status,
    });
});

/** An `error(503, ...)` is a plain object: as an `Error`, its issue is titled by its status. */
class HttpError extends Error {
  override name = 'HttpError';
}

export const handleError: HandleServerError = (input) => {
  if (input.kind === 'unknown') return reportError(input);
  // The status goes on the issue (and in its title), so a 503 is not just "an object".
  Sentry.setTag('status', input.error.status);
  return reportError({
    ...input,
    error: Object.assign(new HttpError(`HttpError ${input.error.status}`), input.error),
  } as typeof input);
};
