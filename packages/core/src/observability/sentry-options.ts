import { withStaticSpan } from '@sentry/core';
import type { ErrorEvent, Log, SpanJSON, TransactionEvent } from '@sentry/core';
import { safeFields, scrubString, type AppName } from './privacy';
import { buildInfoOf, type BuildEnv } from '../server/build-info';

// The SDK's platform-neutral core: every Sentry SDK (SvelteKit, Cloudflare, Node) takes these shapes,
// so each host shares one privacy policy. `withStaticSpan` is the only runtime import.

/**
 * A request the app cancelled itself (TanStack Query aborting a refetch it replaced, a closed tab)
 * surfaces as an `AbortError`. Nothing failed, so it is not reported.
 */
const cancelled = (event: ErrorEvent) =>
  event.exception?.values?.some((exception) => exception.type === 'AbortError') ?? false;

/** Flag evaluations the request recorded (`recordFlag`): only flag-shaped names and booleans. */
const flagsOf = (event: ErrorEvent) => {
  const values = event.contexts?.flags?.values?.filter(
    ({ flag, result }) => /^[a-z][a-z0-9_]*$/.test(flag) && typeof result === 'boolean',
  );
  return values?.length ? { flags: { values } } : undefined;
};

/** The contexts that survived, or none at all. */
const optionalContexts = <T extends Record<string, unknown>>(contexts: T) => {
  const kept = Object.fromEntries(Object.entries(contexts).filter(([, value]) => value));
  return Object.keys(kept).length ? (kept as T) : undefined;
};

/**
 * Where the event ran, never who sent it: the runtime's name and version, the cloud provider and
 * region the SDK set and, from the browser, the browser and OS families (names only). Workers expose no CPU, memory, OS or host name; the data center that served a
 * request travels as the `colo` tag (`coloOf`).
 */
const hostContexts = (event: { contexts?: ErrorEvent['contexts'] }) => {
  const runtime = event.contexts?.runtime;
  const cloud = event.contexts?.cloud_resource;
  const label = (value: unknown) =>
    typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,64}$/.test(value) ? value : undefined;
  // The browser sets only family names (apps/web/src/lib/observability/client-family.ts).
  const family = (context: { name?: unknown } | undefined) =>
    context && label(context.name) && { name: label(context.name) };
  const kept = {
    runtime: runtime && { name: label(runtime.name), version: label(runtime.version) },
    browser: family(event.contexts?.browser),
    os: family(event.contexts?.os),
    cloud_resource: cloud && {
      'cloud.provider': label(cloud['cloud.provider']),
      'cloud.region': label(cloud['cloud.region']),
    },
  };
  return Object.fromEntries(Object.entries(kept).filter(([, value]) => value));
};

/**
 * The Cloudflare data center (IATA code, e.g. `GRU`) that served a request: the runtime's
 * `request.cf.colo`, else the suffix of the `cf-ray` header. Undefined off Cloudflare.
 */
export const coloOf = (request: Request): string | undefined => {
  const colo = (request as { cf?: { colo?: unknown } }).cf?.colo;
  if (typeof colo === 'string' && /^[A-Z]{3}$/.test(colo)) return colo;
  return request.headers.get('cf-ray')?.match(/-([A-Z]{3})$/)?.[1];
};

export function privateEvent(event: ErrorEvent): ErrorEvent | null {
  if (cancelled(event)) return null;
  // Reconstruct rather than redact unknown SDK contexts. Keep code locations and the flags the
  // request read for diagnosis, never exception messages, local variables, source context,
  // breadcrumbs or request data.
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    environment: event.environment,
    tags: safeFields(event.tags),
    contexts: optionalContexts({ ...flagsOf(event), ...hostContexts(event) }),
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

/** A URL or path without its query string or fragment, which may carry tokens or search terms. */
const withoutQuery = (text: string) => text.replace(/[?#]\S*/g, '');

/** SQL with its literals replaced, so a statement names tables and columns but no values. */
const withoutLiterals = (sql: string) =>
  sql.replace(/'(?:[^']|'')*'/g, '?').replace(/\b\d+(?:\.\d+)?\b/g, '?');

// Span attributes that describe the operation, never its payload.
const SPAN_LABELS = new Set([
  'http.request.method',
  'http.method',
  'http.route',
  'server.address',
  'url.scheme',
  'network.protocol.name',
  'db.system',
  'db.system.name',
  'db.operation.name',
  'faas.trigger',
  'faas.cron',
  'sentry.op',
  'sentry.origin',
  'sentry.source',
  'resource.render_blocking_status',
]);

/**
 * One span as Sentry may see it: timing, operation and status, a description without query strings
 * or SQL literals, and only numeric or labelled attributes. Applied to every span of a transaction
 * and to the browser's standalone Web Vitals spans.
 */
export function privateSpan(span: SpanJSON): SpanJSON {
  const data: SpanJSON['data'] = {};
  for (const [key, value] of Object.entries(span.data ?? {})) {
    if (typeof value === 'number' || typeof value === 'boolean') data[key] = value;
    else if (SPAN_LABELS.has(key) && typeof value === 'string') data[key] = withoutQuery(value);
  }
  const description =
    span.description &&
    scrubString(
      span.op?.startsWith('db')
        ? withoutLiterals(span.description)
        : withoutQuery(span.description),
    );
  return {
    span_id: span.span_id,
    parent_span_id: span.parent_span_id,
    trace_id: span.trace_id,
    segment_id: span.segment_id,
    is_segment: span.is_segment,
    op: span.op,
    origin: span.origin,
    status: span.status,
    start_timestamp: span.start_timestamp,
    timestamp: span.timestamp,
    exclusive_time: span.exclusive_time,
    measurements: span.measurements,
    description,
    data,
  };
}

/**
 * A transaction rebuilt from the parts that measure performance: its route, timings, Web Vitals and
 * spans. No request, user, breadcrumbs or extra data; tags pass the same allowlist as errors.
 */
export function privateTransaction(event: TransactionEvent): TransactionEvent {
  const trace = event.contexts?.trace;
  return {
    type: 'transaction',
    event_id: event.event_id,
    timestamp: event.timestamp,
    start_timestamp: event.start_timestamp,
    platform: event.platform,
    release: event.release,
    dist: event.dist,
    environment: event.environment,
    transaction: event.transaction && scrubString(withoutQuery(event.transaction)),
    transaction_info: event.transaction_info,
    tags: safeFields(event.tags),
    measurements: event.measurements,
    contexts: optionalContexts({
      ...hostContexts(event),
      trace: trace && {
        trace_id: trace.trace_id,
        span_id: trace.span_id,
        parent_span_id: trace.parent_span_id,
        op: trace.op,
        origin: trace.origin,
        status: trace.status,
        data: privateSpan({
          span_id: trace.span_id ?? '',
          trace_id: trace.trace_id ?? '',
          start_timestamp: 0,
          status: '',
          data: trace.data ?? {},
        }).data,
      },
    }),
    spans: event.spans?.map(privateSpan),
  };
}

/**
 * The share of requests, page loads and cron runs traced. Grave chose 100% on 2026-10-26 while
 * traffic is low, to fill the performance dashboard; lower it here when the span quota matters.
 */
export const TRACES_SAMPLE_RATE = 1;

/**
 * What every deployment of the app sends to Sentry, whatever the SDK or the entrypoint: no PII, no
 * request data, no automatic capture beyond performance traces, which pass `privateTransaction`.
 * The caller adds `dsn` and `environment`.
 */
export const privateSentryOptions = {
  sendDefaultPii: false,
  tracesSampleRate: TRACES_SAMPLE_RATE,
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
  beforeSendTransaction: privateTransaction,
  beforeSendSpan: withStaticSpan(privateSpan),
  beforeSendMetric: () => null,
  beforeBreadcrumb: () => null,
};

/**
 * `privateSentryOptions` for one app: every event and transaction is tagged `app` (web, api or worker), whatever
 * scope raised it, so issues from the three deployables can be told apart and filtered.
 */
export const sentryOptionsForApp = (app: AppName) => ({
  ...privateSentryOptions,
  initialScope: { tags: { app } },
  beforeSend: (event: ErrorEvent) => privateEvent({ ...event, tags: { ...event.tags, app } }),
  beforeSendTransaction: (event: TransactionEvent) =>
    privateTransaction({ ...event, tags: { ...event.tags, app } }),
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
