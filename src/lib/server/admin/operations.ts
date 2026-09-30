import { and, asc, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { events } from '../db/schema';
import { authorize, type Actor } from '../auth/policy';
import { Invalid } from '../errors';
import { MAX_ATTEMPTS } from '../events/dispatcher';
import { recordEvent } from '../events/outbox';

export const WORK_LIMIT = 50;

/** Work that has not finished and has not been given up on. */
const waiting = and(isNull(events.processedAt), isNull(events.failedAt));

export type QueueHealth = {
  pending: number;
  failed: number;
  /** How long the oldest pending event has been waiting, in seconds; null when nothing waits. */
  oldestPendingSeconds: number | null;
  retrying: number;
  byType: { type: string; pending: number; failed: number }[];
};

/** The outbox at a glance: what waits, what is being retried, what was given up on, and for how long. */
export async function queueHealth(db: AnyDb, now = new Date()): Promise<QueueHealth> {
  const [totals] = await db
    .select({
      pending: count(sql`case when ${waiting} then 1 end`),
      retrying: count(sql`case when ${waiting} and ${events.attempts} > 0 then 1 end`),
      failed: count(sql`case when ${isNotNull(events.failedAt)} then 1 end`),
      oldest: sql<Date | null>`min(case when ${waiting} then ${events.createdAt} end)`,
    })
    .from(events);
  const byType = await db
    .select({
      type: events.type,
      pending: count(sql`case when ${waiting} then 1 end`),
      failed: count(sql`case when ${isNotNull(events.failedAt)} then 1 end`),
    })
    .from(events)
    .where(sql`${waiting} or ${isNotNull(events.failedAt)}`)
    .groupBy(events.type)
    .orderBy(asc(events.type));
  const oldest = totals.oldest ? new Date(totals.oldest) : null;
  return {
    pending: totals.pending,
    retrying: totals.retrying,
    failed: totals.failed,
    oldestPendingSeconds: oldest
      ? Math.max(0, Math.round((now.getTime() - oldest.getTime()) / 1000))
      : null,
    byType,
  };
}

export type WorkRow = {
  id: string;
  type: string;
  state: 'pending' | 'failed';
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  handledBy: string[];
  /** Already scrubbed of e-mail addresses and tokens when it was written. */
  lastError: string | null;
};

/**
 * The events that have not finished, the failed ones first and then the oldest pending. The payload
 * is left out on purpose: this is about delivery, not about what the events say.
 */
export async function listWork(db: AnyDb, limit = WORK_LIMIT): Promise<WorkRow[]> {
  const rows = await db
    .select({
      id: events.id,
      type: events.type,
      failedAt: events.failedAt,
      createdAt: events.createdAt,
      attempts: events.attempts,
      nextAttemptAt: events.nextAttemptAt,
      handledBy: events.handledBy,
      lastError: events.lastError,
    })
    .from(events)
    .where(sql`${waiting} or ${isNotNull(events.failedAt)}`)
    .orderBy(
      sql`(${events.failedAt} is null)`,
      desc(events.failedAt),
      asc(events.createdAt),
      asc(events.id),
    )
    .limit(limit);
  return rows.map(({ failedAt, ...row }) => ({
    ...row,
    state: failedAt ? ('failed' as const) : ('pending' as const),
    maxAttempts: MAX_ATTEMPTS,
  }));
}

/**
 * Puts a failed event back in line: it is due now and gets its attempts back. What its handlers
 * already did stays (`handled_by`), so a retry runs only the handlers that have not succeeded, and
 * those are idempotent by the event id: repeating it can neither write a bell twice nor send an
 * e-mail again. An event that finished has nothing to retry. The retry itself is recorded.
 */
export async function retryEvent(db: AnyDb, actor: Actor | null, id: string): Promise<string> {
  authorize(actor, 'admin:access');
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(events)
      .set({
        failedAt: null,
        attempts: 0,
        nextAttemptAt: new Date(),
        claimedUntil: null,
      })
      .where(and(eq(events.id, id), isNotNull(events.failedAt), isNull(events.processedAt)))
      .returning({ type: events.type });
    if (!row) throw new Invalid('id', 'not_retryable');
    return recordEvent(tx, {
      type: 'QueueRetryRequested',
      actorId: actor!.id,
      payload: { eventId: id, eventType: row.type },
    });
  });
}
