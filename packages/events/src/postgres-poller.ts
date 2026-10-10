import { and, asc, inArray, isNull, lte, or } from 'drizzle-orm';
import { events, type AnyDb } from '@mesaaberta/db';
import { SUPPORTED_EVENT_VERSIONS, type JobExecutor, type JobOutcome } from './transport';

export type PollSummary = {
  /** Events handed to the executor. */
  tried: number;
  done: number;
  retry: number;
  failed: number;
};

/**
 * The Postgres transport for a deployment without a queue (self-host, and the default): the outbox
 * is the queue, so there is nothing to enqueue. A poll finds the events that are due, oldest first,
 * and hands each reference to the executor, which claims the row, runs the handlers that have not
 * succeeded and reports an explicit outcome.
 *
 * The executor persists the result on the row (processed, next attempt, given up), so the poller
 * keeps no state of its own: running it twice, or from two workers, is safe because the executor's
 * claim is a lease. Rows whose version this build cannot read are not selected, so a newer
 * producer's events wait for a newer consumer instead of failing here.
 */
export async function pollOutbox(
  db: AnyDb,
  execute: JobExecutor,
  { now = new Date(), limit = 50 }: { now?: Date; limit?: number } = {},
): Promise<PollSummary> {
  const rows = await db
    .select({ id: events.id, type: events.type, version: events.version })
    .from(events)
    .where(
      and(
        isNull(events.processedAt),
        isNull(events.failedAt),
        lte(events.nextAttemptAt, now),
        or(isNull(events.claimedUntil), lte(events.claimedUntil, now)),
        inArray(events.version, [...SUPPORTED_EVENT_VERSIONS]),
      ),
    )
    .orderBy(asc(events.createdAt))
    .limit(limit);

  const summary: PollSummary = { tried: 0, done: 0, retry: 0, failed: 0 };
  for (const row of rows) {
    let outcome: JobOutcome;
    try {
      outcome = await execute({ eventId: row.id, type: row.type, version: row.version });
    } catch (error) {
      // An executor that throws did not persist an outcome: leave the row for the next poll.
      outcome = {
        status: 'retry',
        afterSeconds: 0,
        reason: error instanceof Error ? error.name : 'unknown error',
      };
    }
    summary.tried += 1;
    summary[outcome.status] += 1;
  }
  return summary;
}
