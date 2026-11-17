import type { QueryObserver } from '../server/db/client';

/** The two calls of a Sentry SDK this needs; `@sentry/cloudflare` passes as it is. */
export type SpanSdk = {
  getActiveSpan(): unknown;
  startInactiveSpan(options: { op: string; name: string; attributes: Record<string, string> }): {
    setStatus(status: { code: number; message?: string }): unknown;
    end(): void;
  };
};

/** The verb of a statement (`select`, `insert`…), which Sentry groups queries by. */
const operationOf = (sql: string) => /^\s*(\w+)/.exec(sql)?.[1]?.toLowerCase();

/**
 * Records each query as a Sentry `db` span under the active span (a request, a cron run), so traces
 * show where the time goes and Sentry's N+1 and consecutive-query detectors see repeated queries.
 * The SQL Drizzle sends holds `$1` placeholders, not values; `privateSpan` strips any literal left
 * before sending. Without an active span (Sentry off) nothing is recorded. Set it with
 * `observeQueries(querySpans(Sentry))` at a Worker's startup.
 */
export const querySpans =
  (sdk: SpanSdk): QueryObserver =>
  (sql) => {
    if (!sdk.getActiveSpan()) return;
    const operation = operationOf(sql);
    const span = sdk.startInactiveSpan({
      op: 'db',
      name: sql,
      attributes: {
        'db.system': 'postgresql',
        ...(operation ? { 'db.operation.name': operation } : {}),
      },
    });
    return (error) => {
      if (error) span.setStatus({ code: 2, message: 'internal_error' });
      span.end();
    };
  };
