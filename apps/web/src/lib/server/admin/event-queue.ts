import { eventQueue as readEventQueue } from '@mesaaberta/core/server/admin/event-queue';
import type { Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import type { Handler } from '../events/types';
import { eventFilters } from '$lib/admin/event-filters';

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
