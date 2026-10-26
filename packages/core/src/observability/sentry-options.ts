import type { ErrorEvent, Log } from '@sentry/core';
import { safeFields, scrubString, type AppName } from './privacy';
import { buildInfoOf, type BuildEnv } from '../server/build-info';

// Type-only imports from the SDK's platform-neutral core: nothing is bundled by this file, and every
// Sentry SDK (SvelteKit, Cloudflare, Node) takes these shapes, so each host shares one privacy policy.

/**
 * A request the app cancelled itself (TanStack Query aborting a refetch it replaced, a closed tab)
 * surfaces as an `AbortError`. Nothing failed, so it is not reported.
 */
const cancelled = (event: ErrorEvent) =>
  event.exception?.values?.some((exception) => exception.type === 'AbortError') ?? false;

export function privateEvent(event: ErrorEvent): ErrorEvent | null {
  if (cancelled(event)) return null;
  // Reconstruct rather than redact unknown SDK contexts. Keep code locations for diagnosis,
  // never exception messages, local variables, source context, breadcrumbs or request data.
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    environment: event.environment,
    tags: safeFields(event.tags),
    debug_meta: event.debug_meta && {
      images: event.debug_meta.images?.flatMap((image) =>
        image.type === 'sourcemap'
          ? [
              {
                type: 'sourcemap' as const,
                debug_id: image.debug_id,
                code_file: image.code_file.split(/[?#]/)[0],
              },
            ]
          : [],
      ),
    },
    exception: event.exception && {
      values: event.exception.values?.map((exception) => ({
        type: exception.type && /^[A-Za-z]+Error$/.test(exception.type) ? exception.type : 'Error',
        value: 'Exception details withheld; correlate by requestId and code location',
        stacktrace: exception.stacktrace && {
          frames: exception.stacktrace.frames?.map((frame) => ({
            filename: frame.filename?.split(/[?#]/)[0],
            function: frame.function,
            lineno: frame.lineno,
            colno: frame.colno,
            in_app: frame.in_app,
          })),
        },
      })),
    },
  };
}

export function privateLog(log: Log): Log | null {
  // Only the application's controlled logger may emit logs; no automatic console capture.
  if (log.attributes?.service !== 'mesaaberta') return null;
  return {
    level: log.level,
    message: scrubString(String(log.message)),
    attributes: safeFields(log.attributes),
  };
}

/**
 * What every deployment of the app sends to Sentry, whatever the SDK or the entrypoint: no PII, no
 * request data, no automatic capture. The caller adds `dsn` and `environment`.
 */
export const privateSentryOptions = {
  sendDefaultPii: false,
  tracesSampleRate: 0,
  traceLifecycle: 'static' as const,
  dataCollection: {
    userInfo: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    httpBodies: [],
    httpHeaders: false,
    cookies: false,
    urlQueryParams: false,
    stackFrameVariables: false,
    frameContextLines: 0,
  },
  beforeSend: privateEvent,
  beforeSendLog: privateLog,
  beforeSendTransaction: () => null,
  beforeSendMetric: () => null,
  beforeBreadcrumb: () => null,
};

/**
 * `privateSentryOptions` for one app: every event is tagged `app` (web, api or worker), whatever
 * scope raised it, so issues from the three deployables can be told apart and filtered.
 */
export const sentryOptionsForApp = (app: AppName) => ({
  ...privateSentryOptions,
  initialScope: { tags: { app } },
  beforeSend: (event: ErrorEvent) => privateEvent({ ...event, tags: { ...event.tags, app } }),
});

export type ReleaseEnv = BuildEnv & { CF_VERSION_METADATA?: { id?: string } };

/**
 * The `release` and `dist` an app's server events carry. The deploy uploads each Worker's bundled
 * source maps under the release tag (`DEPLOYMENT_VERSION`) with the app as the dist, so events must
 * name the same pair for Sentry to map `app:///_worker.js` frames. Without a tag (local and
 * self-hosted runs) the Worker version id stays the release, as before.
 */
export const sentryReleaseFor = (app: AppName, env: ReleaseEnv | undefined) => {
  const { version } = buildInfoOf(env);
  return version ? { release: version, dist: app } : { release: env?.CF_VERSION_METADATA?.id };
};
