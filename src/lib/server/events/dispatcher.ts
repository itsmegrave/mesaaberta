import { and, asc, eq, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { events } from '../db/schema';
import { scrubString } from '../logger';
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
		or(isNull(events.claimedUntil), lte(events.claimedUntil, now))
	);

const describe = (error: unknown) => {
	const { name, message } = error instanceof Error ? error : new Error(String(error));
	// Kept in the audit log, so no email address or token that an error message happened to carry.
	return scrubString(`${name}: ${message}`).slice(0, 500);
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
	now = new Date()
): Promise<void> {
	const [row] = await db
		.update(events)
		.set({ claimedUntil: new Date(now.getTime() + LEASE_MS) })
		.where(and(eq(events.id, id), due(now)))
		.returning();
	if (!row) return; // done, given up on, not due yet, or being run by someone else

	const event = {
		id: row.id,
		type: row.type,
		payload: row.payload,
		actorId: row.actorId,
		createdAt: row.createdAt,
		attempts: row.attempts
	} as StoredEvent;
	const pending = handlers.filter(
		(handler) =>
			handler.types.includes(event.type as DomainEvent['type']) &&
			!row.handledBy.includes(handler.name)
	);

	const failures: unknown[] = [];
	for (const handler of pending) {
		try {
			await handler.handle(event, db);
			await db
				.update(events)
				.set({ handledBy: sql`array_append(${events.handledBy}, ${handler.name})` })
				.where(eq(events.id, id));
		} catch (error) {
			failures.push(error);
		}
	}

	if (failures.length === 0) {
		await db
			.update(events)
			.set({ processedAt: now, claimedUntil: null, lastError: null })
			.where(eq(events.id, id));
		return;
	}

	const attempts = row.attempts + 1;
	await db
		.update(events)
		.set({
			attempts,
			claimedUntil: null,
			lastError: describe(failures[0]),
			...(attempts >= MAX_ATTEMPTS
				? { failedAt: now }
				: { nextAttemptAt: new Date(now.getTime() + backoffSeconds(attempts) * 1000) })
		})
		.where(eq(events.id, id));
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
	limit = 50
): Promise<number> {
	const rows = await db
		.select({ id: events.id })
		.from(events)
		.where(due(now))
		.orderBy(asc(events.createdAt))
		.limit(limit);

	for (const { id } of rows) await dispatchEvent(db, handlers, id, now);

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
				and(eq(events.type, 'UserSignedIn'), finishedBefore(connectionCutoff))
			)
		)
		.returning({ id: events.id });

	return deleted.length;
}
