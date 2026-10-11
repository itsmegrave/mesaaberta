import type { ErrorEvent, Log } from '@sentry/sveltekit';
import { safeFields, scrubString } from '@mesaaberta/core/observability/privacy';

// The vendor-neutral helpers live in @mesaaberta/core; this file adds the Sentry-specific parts and
// keeps the old import path working.
export * from '@mesaaberta/core/observability/privacy';

export function privateEvent(event: ErrorEvent): ErrorEvent {
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

export const sentryOptions = {
  dsn: 'https://b1de43dab20b6ee298e5b5725ee38262@o4512176851714048.ingest.us.sentry.io/4512176861937664',
  sendDefaultPii: false,
  environment: 'production',
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
