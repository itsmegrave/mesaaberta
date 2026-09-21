import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import type { AnyDb } from './db/client';
import { events } from './db/schema';
import { RateLimited } from './errors';
import type { EventType } from './events/types';

/**
 * Per-person limits on what a signed-in user can do, so an open door (any member may open a table)
 * is not a spam door. Workers keep no memory between requests, so nothing is counted in a cache:
 * the count is read from the `events` audit log, which already has a row per creation and per
 * join, is never deleted (a join that is left and repeated still counts) and is indexed by
 * `(actor_id, created_at)`. A refused request wrote nothing, so it never uses up the limit.
 *
 * To limit another action (reports, say), record an event for it and add a named limit here.
 */
export type RateLimit = {
	/** The event types that use the limit up, counted together. */
	events: readonly EventType[];
	/** How many are allowed in any `windowSeconds`. */
	max: number;
	windowSeconds: number;
};

// Opening a table is rare for a real GM (a campaign is one table) and one abuse would flood the
// listing, so this is tight: 5 in an hour still leaves room for a GM setting up a small season.
export const TABLE_CREATION_LIMIT = {
	events: ['TableCreated'],
	max: 5,
	windowSeconds: 3600
} as const satisfies RateLimit;

// Someone browsing may ask for several tables in one sitting, and a request to an approval table
// counts as much as a seat. 20 in an hour is far above that and far below a script.
export const JOIN_LIMIT = {
	events: ['PlayerJoined', 'JoinRequested'],
	max: 20,
	windowSeconds: 3600
} as const satisfies RateLimit;

/**
 * Throws `RateLimited` when `actorId` already used `limit` up in the window ending at `now`,
 * telling how long until one use ages out. An event is in the window while it is younger than
 * `windowSeconds`, so it leaves exactly one window after it happened.
 *
 * This only reads, so it is a cheap look before costly work (storing an upload): two simultaneous
 * requests can both pass it. Use `enforceRateLimit` where the event is written.
 */
export async function checkRateLimit(
	db: AnyDb,
	actorId: string,
	limit: RateLimit,
	now: Date = new Date()
): Promise<void> {
	const windowStart = new Date(now.getTime() - limit.windowSeconds * 1000);
	// The newest `max` events in the window. If there are that many, the oldest of them is the one
	// that must age out before the person is back under the limit.
	const used = await db
		.select({ createdAt: events.createdAt })
		.from(events)
		.where(
			and(
				eq(events.actorId, actorId),
				inArray(events.type, [...limit.events]),
				gt(events.createdAt, windowStart)
			)
		)
		.orderBy(desc(events.createdAt))
		.limit(limit.max);
	if (used.length < limit.max) return;

	const frees = used[used.length - 1].createdAt.getTime() + limit.windowSeconds * 1000;
	throw new RateLimited(Math.max(1, Math.ceil((frees - now.getTime()) / 1000)));
}

/**
 * `checkRateLimit`, made safe against simultaneous requests. Call it inside the transaction that
 * writes the event it limits. It first takes a lock on the person (released at commit), so two
 * requests cannot both read "one left" and both go through.
 */
export async function enforceRateLimit(
	db: AnyDb,
	actorId: string,
	limit: RateLimit,
	now: Date = new Date()
): Promise<void> {
	await db.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`rate-limit:${actorId}`}, 0))`
	);

	await checkRateLimit(db, actorId, limit, now);
}
