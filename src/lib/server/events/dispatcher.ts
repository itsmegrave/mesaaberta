import { and, asc, eq, isNotNull, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { events } from '../db/schema';
import { recordEvent } from './outbox';
import { fencedFor } from './fencing';
import { logger, scrubString, type Logger } from '../logger';
import type { DomainEvent, Handler, StoredEvent } from './types';

/** After this many failed attempts an event is given up on, and stays for a person to look at. */
export const MAX_ATTEMPTS = 8;
const LEASE_MS = 2 * 60_000;

/** Seconds to wait after the nth failed attempt: 30, 60, 120, ... up to an hour. */
export const backoffSeconds = (attempts: number) => Math.min(30 * 2 ** (attempts - 1), 3600);

const due = (now: Date) =>
  and(
    isNull(events.processedAt),
    isNull(events.failedAt),
    lte(events.nextAttemptAt, now),
    or(isNull(events.claimedUntil), lte(events.claimedUntil, now)),
  );

const describe = (error: unknown) => {
  const { name, message } = error instanceof Error ? error : new Error(String(error));
  // Kept in the audit log, so no email address or token that an error message happened to carry.
  return scrubString(`${name}: ${message}`).slice(0, 500);
};

export type DispatchOptions = {
  /**
   * Owner-fenced leases (ADR 0003): the claim gets a token and every update to the row is
   * conditional on it. Defaults to the request's `api_events_fenced_leases` flag.
   */
  fenced?: boolean;
  /** A fresh clock for each claim, so a slow sweep never grants a lease that is already over. */
  clock?: () => Date;
};

/**
 * Runs the handlers for one event, if it is due and nobody else is running it. Safe to call from
 * anywhere and any number of times: a processed or given-up event is left alone, and a lease stops
 * two dispatchers from running the same event at once.
 *
 * Handlers that already succeeded are not run again; the ones that fail are retried later with
 * backoff, up to `MAX_ATTEMPTS`. It never throws for a handler's failure.
 */
export async function dispatchEvent(
  db: AnyDb,
  handlers: readonly Handler[],
  id: string,
  now = new Date(),
  log: Logger = logger,
  options: DispatchOptions = {},
): Promise<void> {
  const fenced = options.fenced ?? (await fencedFor(db));
  const tick = () => (fenced && options.clock ? options.clock() : now);
  // Fenced: a token that only this claim holds. Unfenced still clears it, so a dispatcher that
  // holds a token loses it when an older one claims the row.
  const token = fenced ? crypto.randomUUID() : null;
  const claimedAt = tick();
  const [row] = await db
    .update(events)
    .set({ claimedUntil: new Date(claimedAt.getTime() + LEASE_MS), claimToken: token })
    .where(and(eq(events.id, id), due(claimedAt)))
    .returning();
  if (!row) return; // done, given up on, not due yet, or being run by someone else

  // Fenced updates only land while this claim still owns the row.
  const owned = fenced ? and(eq(events.id, id), eq(events.claimToken, token!)) : eq(events.id, id);
  const lost = () =>
    log.warn('event.lease.lost', { event: 'event.lease.lost', eventId: id, eventType: row.type });

  const event = {
    id: row.id,
    type: row.type,
    payload: row.payload,
    actorId: row.actorId,
    createdAt: row.createdAt,
    attempts: row.attempts,
  } as StoredEvent;
  const pending = handlers.filter(
    (handler) =>
      handler.types.includes(event.type as DomainEvent['type']) &&
      !row.handledBy.includes(handler.name),
  );

  const failures: unknown[] = [];
  for (const handler of pending) {
    const started = Date.now();
    const context = {
      eventId: id,
      eventType: event.type,
      handler: handler.name,
      attempt: row.attempts + 1,
    };
    try {
      await handler.handle(event, db);
      const marked = await db
        .update(events)
        .set({ handledBy: sql`array_append(${events.handledBy}, ${handler.name})` })
        .where(owned)
        .returning({ id: events.id });
      if (fenced && marked.length === 0) return lost(); // someone else owns it now: stop, touch nothing
      log.info('event.handler.succeeded', {
        ...context,
        event: 'event.handler.succeeded',
        durationMs: Date.now() - started,
      });
    } catch (error) {
      log.warn('event.handler.failed', {
        ...context,
        event: 'event.handler.failed',
        durationMs: Date.now() - started,
        error,
      });
      failures.push(error);
    }
  }

  if (failures.length === 0) {
    const done = await db
      .update(events)
      .set({ processedAt: tick(), claimedUntil: null, claimToken: null, lastError: null })
      .where(owned)
      .returning({ id: events.id });
    if (fenced && done.length === 0) lost();
    return;
  }

  const attempts = row.attempts + 1;
  log[attempts >= MAX_ATTEMPTS ? 'error' : 'warn'](
    attempts >= MAX_ATTEMPTS ? 'event.exhausted' : 'event.retry.scheduled',
    {
      eventId: id,
      eventType: event.type,
      attempt: attempts,
      outcome: attempts >= MAX_ATTEMPTS ? 'exhausted' : 'retry',
      ...(attempts >= MAX_ATTEMPTS && { error: failures[0] }),
      ...(attempts < MAX_ATTEMPTS && { retryInSeconds: backoffSeconds(attempts) }),
    },
  );
  const failedAt = tick();
  const failed = await db
    .update(events)
    .set({
      attempts,
      claimedUntil: null,
      claimToken: null,
      lastError: describe(failures[0]),
      ...(attempts >= MAX_ATTEMPTS
        ? { failedAt }
        : { nextAttemptAt: new Date(failedAt.getTime() + backoffSeconds(attempts) * 1000) }),
    })
    .where(owned)
    .returning({ id: events.id });
  if (fenced && failed.length === 0) lost();
}

/** What `forceEvent` did with an event. */
export type ForceOutcome =
  /** Every handler succeeded now. */
  | 'processed'
  /** A handler failed again: it waits for its next attempt, or was given up on once more. */
  | 'failed'
  /** Someone else is running it at this moment. */
  | 'running'
  /** Done before: there is nothing left to run. */
  | 'already_processed'
  | 'not_found';

/**
 * An admin's "run it now": makes the event due and dispatches it at once, instead of waiting for
 * its backoff. A given-up event gets a fresh round of `MAX_ATTEMPTS`. The handlers that already
 * succeeded are not run again (`handledBy`), so it is as safe as the sweeper's own retry. Refused
 * while another dispatcher holds the lease, and a processed event has nothing to run. The one
 * conditional UPDATE is what makes it due, so it cannot race the sweeper. Each forced run is
 * recorded (`EventForced`) for the audit log.
 */
export async function forceEvent(
  db: AnyDb,
  handlers: readonly Handler[],
  id: string,
  adminId: string,
  now = new Date(),
  log: Logger = logger,
  options: DispatchOptions = {},
): Promise<ForceOutcome> {
  const [row] = await db
    .update(events)
    .set({
      attempts: sql`CASE WHEN ${events.failedAt} IS NOT NULL THEN 0 ELSE ${events.attempts} END`,
      failedAt: null,
      nextAttemptAt: now,
    })
    .where(
      and(
        eq(events.id, id),
        isNull(events.processedAt),
        or(isNull(events.claimedUntil), lte(events.claimedUntil, now)),
      ),
    )
    .returning({ type: events.type });
  if (!row) {
    const [found] = await db
      .select({ processedAt: events.processedAt })
      .from(events)
      .where(eq(events.id, id));
    if (!found) return 'not_found';
    return found.processedAt ? 'already_processed' : 'running';
  }

  log.info('event.forced', { event: 'event.forced', eventId: id, eventType: row.type, adminId });
  const recorded = await recordEvent(
    db,
    { type: 'EventForced', actorId: adminId, payload: { eventId: id, eventType: row.type } },
    { now },
  );
  await dispatchEvent(db, handlers, id, now, log, options);
  await dispatchEvent(db, handlers, recorded, now, log, options);

  const [after] = await db
    .select({ processedAt: events.processedAt })
    .from(events)
    .where(eq(events.id, id));
  return after?.processedAt ? 'processed' : 'failed';
}

/** How many given-up events one "run them all" takes up: a bound, so one request stays short. */
export const RETRY_ALL_LIMIT = 25;

/**
 * "Run all the failed ones": forces the given-up events, oldest first, up to `RETRY_ALL_LIMIT`,
 * each one recorded as `EventForced`. Returns how many it ran and how many of those went
 * through; `remaining` is what is still given up on after this call.
 */
export async function forceFailedEvents(
  db: AnyDb,
  handlers: readonly Handler[],
  adminId: string,
  now = new Date(),
  log: Logger = logger,
  options: DispatchOptions = {},
) {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(isNull(events.processedAt), isNotNull(events.failedAt)))
    .orderBy(asc(events.createdAt))
    .limit(RETRY_ALL_LIMIT);

  let processed = 0;
  for (const { id } of rows) {
    if ((await forceEvent(db, handlers, id, adminId, now, log, options)) === 'processed')
      processed++;
  }
  const [{ remaining }] = await db
    .select({ remaining: sql<number>`count(*)`.mapWith(Number) })
    .from(events)
    .where(and(isNull(events.processedAt), isNotNull(events.failedAt)));

  return { tried: rows.length, processed, remaining };
}

/**
 * The sweeper, run by the Cron Trigger: dispatches events that are due, oldest first. This is what
 * retries a failed event after its backoff, and what picks up one whose first dispatch never
 * happened (the Worker stopped right after the commit). Returns how many it tried.
 */
export async function sweepEvents(
  db: AnyDb,
  handlers: readonly Handler[],
  now = new Date(),
  limit = 50,
  log: Logger = logger,
  options: DispatchOptions = {},
): Promise<number> {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(due(now))
    .orderBy(asc(events.createdAt))
    .limit(limit);

  for (const { id } of rows) await dispatchEvent(db, handlers, id, now, log, options);

  return rows.length;
}

/** Days a finished event stays in the audit log. The privacy policy promises this; keep them in step. */
export const RETENTION_DAYS = 90;

/**
 * Days a finished `UserSignedIn` event stays: the connection log Marco Civil da Internet (art. 15)
 * requires kept for 6 months. The privacy policy promises this too; keep them in step.
 */
export const CONNECTION_RETENTION_DAYS = 180;

const finishedBefore = (cutoff: Date) =>
  or(lt(events.processedAt, cutoff), lt(events.failedAt, cutoff));

/**
 * Deletes the events that finished (processed, or given up on) more than their retention period
 * ago: `CONNECTION_RETENTION_DAYS` for `UserSignedIn`, `RETENTION_DAYS` for everything else.
 * Pending events stay, whatever their age. Returns how many were deleted.
 */
export async function pruneEvents(db: AnyDb, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 3600 * 1000);
  const connectionCutoff = new Date(now.getTime() - CONNECTION_RETENTION_DAYS * 24 * 3600 * 1000);
  const deleted = await db
    .delete(events)
    .where(
      or(
        and(ne(events.type, 'UserSignedIn'), finishedBefore(cutoff)),
        and(eq(events.type, 'UserSignedIn'), finishedBefore(connectionCutoff)),
      ),
    )
    .returning({ id: events.id });

  return deleted.length;
}
