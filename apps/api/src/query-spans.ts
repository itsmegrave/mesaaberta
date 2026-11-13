import * as Sentry from '@sentry/cloudflare';
import type { QueryObserver } from '@mesaaberta/core/server/db/client';

/** The verb of a statement (`select`, `insert`…), which Sentry groups queries by. */
const operationOf = (sql: string) => /^\s*(\w+)/.exec(sql)?.[1]?.toLowerCase();

/**
 * Records each query as a Sentry `db` span under the request's span, so traces show where the time
 * goes and Sentry's N+1 and consecutive-query detectors can see repeated queries. The SQL Drizzle
 * sends holds `$1` placeholders, not values; `privateSpan` strips any literal left before sending.
 * Without an active span (Sentry off) nothing is recorded.
 */
export const querySpans: QueryObserver = (sql) => {
  if (!Sentry.getActiveSpan()) return;
  const operation = operationOf(sql);
  const span = Sentry.startInactiveSpan({
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
