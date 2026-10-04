import { and, asc, desc, eq, gt, isNotNull, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { authorize, type Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { events, profiles } from '../db/schema';
import { MAX_ATTEMPTS } from '../events/dispatcher';
import type { EventType, Handler } from '../events/types';
import { EVENT_STATUSES, eventFilters, type EventStatus } from '$lib/admin/event-filters';

/** What each tab of the queue is made of. `now` tells a lease that is held from one that ran out. */
function whereStatus(status: EventStatus, now: Date): SQL | undefined {
  const open = and(isNull(events.processedAt), isNull(events.failedAt));
  const leased = and(isNotNull(events.claimedUntil), gt(events.claimedUntil, now));
  const free = or(isNull(events.claimedUntil), lte(events.claimedUntil, now));
  switch (status) {
    case 'failed':
      return and(isNull(events.processedAt), isNotNull(events.failedAt));
    case 'retrying':
      return and(open, free, gt(events.attempts, 0));
    case 'pending':
      return and(open, free, eq(events.attempts, 0));
    case 'running':
      return and(open, leased);
    case 'processed':
      return isNotNull(events.processedAt);
  }
}

/** The events outbox as an admin reads it: what is stuck, what waits, what ran. */
export async function eventQueue(
  db: AnyDb,
  actor: Actor | null,
  handlers: readonly Handler[],
  params: URLSearchParams,
  now = new Date(),
) {
  authorize(actor, 'moderation:manage');
  const filters = eventFilters(params);

  const types = (
    await db.selectDistinct({ type: events.type }).from(events).orderBy(asc(events.type))
  ).map((row) => row.type);
  const type = types.includes(filters.type) ? filters.type : '';
  const ofType = type ? eq(events.type, type) : undefined;

  const counted = await Promise.all(
    EVENT_STATUSES.map(async (status) => {
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)`.mapWith(Number) })
        .from(events)
        .where(and(whereStatus(status, now), ofType));
      return [status, total] as const;
    }),
  );
  const counts = Object.fromEntries(counted) as Record<EventStatus, number>;
  const total = counts[filters.status];
  const pages = Math.max(1, Math.ceil(total / filters.pageSize));
  if (filters.page > pages) return null;

  const actorProfile = alias(profiles, 'actor');
  const rows = await db
    .select({
      id: events.id,
      type: events.type,
      payload: events.payload,
      createdAt: events.createdAt,
      attempts: events.attempts,
      nextAttemptAt: events.nextAttemptAt,
      lastError: events.lastError,
      handledBy: events.handledBy,
      failedAt: events.failedAt,
      processedAt: events.processedAt,
      actor: actorProfile.username,
    })
    .from(events)
    .leftJoin(actorProfile, eq(actorProfile.id, events.actorId))
    .where(and(whereStatus(filters.status, now), ofType))
    // The oldest stuck event first; a finished one, the latest.
    .orderBy(
      filters.status === 'processed' ? desc(events.createdAt) : asc(events.createdAt),
      asc(events.id),
    )
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  return {
    status: filters.status,
    type,
    types,
    counts,
    total,
    page: filters.page,
    pages,
    pageSize: filters.pageSize,
    maxAttempts: MAX_ATTEMPTS,
    rows: rows.map((row) => ({
      ...row,
      // The handlers that have not succeeded for it yet: what a run would do.
      remaining: handlers
        .filter(
          (handler) =>
            handler.types.includes(row.type as EventType) && !row.handledBy.includes(handler.name),
        )
        .map((handler) => handler.name),
    })),
  };
}
export type EventQueue = NonNullable<Awaited<ReturnType<typeof eventQueue>>>;

/** How many events are given up on: the count beside the section in the navigation. */
export async function failedEventCount(db: AnyDb) {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(events)
    .where(and(isNull(events.processedAt), isNotNull(events.failedAt)));
  return total;
}
