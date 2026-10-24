import { and, count, isNotNull, isNull, min } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { events } from '../db/schema';

export type OutboxDepth = {
  /** Events not yet delivered and not given up on. */
  pending: number;
  /** Events that reached the attempt cap and wait for a person (`/admin/events`). */
  failed: number;
  /** Seconds since the oldest pending event was due, 0 when nothing waits. */
  oldestPendingSeconds: number;
};

/**
 * What the outbox holds right now, for the worker's metrics. Reads counts only: no payload, actor
 * or error text leaves the database. `pending` uses the partial index the sweeper uses.
 */
export async function outboxDepth(db: AnyDb, now = new Date()): Promise<OutboxDepth> {
  const [pending] = await db
    .select({ n: count(), oldest: min(events.nextAttemptAt) })
    .from(events)
    .where(and(isNull(events.processedAt), isNull(events.failedAt)));
  const [failed] = await db
    .select({ n: count() })
    .from(events)
    .where(and(isNull(events.processedAt), isNotNull(events.failedAt)));

  return {
    pending: pending.n,
    failed: failed.n,
    oldestPendingSeconds: pending.oldest
      ? Math.max(0, Math.round((now.getTime() - pending.oldest.getTime()) / 1000))
      : 0,
  };
}
