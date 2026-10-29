import { and, isNull, lte, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { events } from '../db/schema';
import type { Logger } from '../logger';

/** An event due this long ago and still not run is late: three sweeps went by without it. */
export const DELAY_ALERT_MINUTES = 15;

/** How many due events are late, and by how much the oldest is (Trello #277). */
export async function outboxDelay(db: AnyDb, now: Date) {
  const late = new Date(now.getTime() - DELAY_ALERT_MINUTES * 60_000);
  const [row] = await db
    .select({
      delayed: sql<number>`count(*)`.mapWith(Number),
      oldest: sql<Date | null>`min(${events.nextAttemptAt})`.mapWith((value) =>
        value ? new Date(value) : null,
      ),
    })
    .from(events)
    .where(
      and(isNull(events.processedAt), isNull(events.failedAt), lte(events.nextAttemptAt, late)),
    );
  return {
    delayed: row?.delayed ?? 0,
    delaySeconds: row?.oldest ? Math.round((now.getTime() - row.oldest.getTime()) / 1000) : 0,
  };
}

/**
 * Raises an issue when the outbox falls behind: the sweep runs, but events wait longer than they
 * should (a handler that hangs, a backlog bigger than a sweep takes). Never throws.
 */
export async function reportDelay(db: AnyDb, now: Date, log: Logger) {
  try {
    const { delayed, delaySeconds } = await outboxDelay(db, now);
    if (delayed > 0)
      log.error('event.backlog.delayed', {
        event: 'event.backlog.delayed',
        code: 'outbox_delayed',
        delayed,
        delaySeconds,
        error: new Error('outbox_delayed'),
      });
  } catch (error) {
    log.warn('event.delay_check_failed', { code: 'delay_check_failed', error });
  }
}
