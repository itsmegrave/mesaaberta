import { eventQueue as readEventQueue } from '@mesaaberta/core/server/admin/event-queue';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import type { Handler } from '@mesaaberta/core/server/events/types';
import { eventFilters } from '#lib/admin/event-filters.js';

// The queue itself moved to @mesaaberta/core; this wrapper reads the filters off the query string.
export { failedEventCount, type EventQueue } from '@mesaaberta/core/server/admin/event-queue';

export function eventQueue(
  db: AnyDb,
  actor: Actor | null,
  handlers: readonly Handler[],
  params: URLSearchParams,
  now = new Date(),
) {
  return readEventQueue(db, actor, handlers, eventFilters(params), now);
}
