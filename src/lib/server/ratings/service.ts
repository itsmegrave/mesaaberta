import { and, eq, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, ratings, registrations } from '../db/schema';
import { rateBlocker, type Actor } from '../auth/policy';
import { Forbidden, NotFound, TooEarly } from '../errors';
import { recordEvent } from '../events/outbox';
import type { RatingInput } from '$lib/tables/rating';

/** Whether the first session is over. You rate what you played; a campaign is rated after its first session. */
export const firstSessionEnded = (
	table: { startsAt: Date; durationMinutes: number },
	now: Date
): boolean => table.startsAt.getTime() + table.durationMinutes * 60_000 <= now.getTime();

/**
 * A player rates the table and its GM, or changes an earlier rating. Needs a confirmed seat, not
 * being the GM, and a first session that has ended (`rateBlocker`). One rating per player: the
 * latest wins. The rating lives and dies with the registration.
 */
export async function submitRating(
	db: AnyDb,
	actor: Actor | null,
	slug: string,
	input: RatingInput,
	now = new Date()
) {
	return db.transaction(async (tx) => {
		const [table] = await tx.select().from(gameTables).where(eq(gameTables.slug, slug));
		if (!table) throw new NotFound(`no table with slug "${slug}"`);

		const [registration] = actor
			? await tx
					.select({ status: registrations.status })
					.from(registrations)
					.where(and(eq(registrations.tableId, table.id), eq(registrations.playerId, actor.id)))
			: [];

		const blocker = rateBlocker(actor, {
			gmId: table.gmId,
			registration: registration?.status ?? null,
			firstSessionEnded: firstSessionEnded(table, now)
		});
		if (blocker === 'too_early') throw new TooEarly();
		if (blocker) throw new Forbidden('table:rate');

		const values = { tableScore: input.tableScore, gmScore: input.gmScore, comment: input.comment };
		await tx
			.insert(ratings)
			.values({ tableId: table.id, playerId: actor!.id, ...values })
			.onConflictDoUpdate({
				target: [ratings.tableId, ratings.playerId],
				set: { ...values, updatedAt: now }
			});

		const eventId = await recordEvent(tx as unknown as AnyDb, {
			type: 'RatingSubmitted',
			actorId: actor!.id,
			// No scores or comment: the audit log keeps who and what, not opinions.
			payload: { tableId: table.id, slug: table.slug, playerId: actor!.id }
		});
		return { eventIds: [eventId] };
	});
}

/** A player's own rating of a table, or null. */
export async function ratingOf(db: AnyDb, tableId: string, playerId: string) {
	const [rating] = await db
		.select()
		.from(ratings)
		.where(and(eq(ratings.tableId, tableId), eq(ratings.playerId, playerId)));

	return rating ?? null;
}

const summary = (row: { average: number | null; count: number }) => ({
	average: row.average === null ? null : Number(row.average),
	count: row.count
});

/** A table's average score and how many rated it. Computed, not stored. */
export async function tableRating(db: AnyDb, tableId: string) {
	const [row] = await db
		.select({
			average: sql<number | null>`avg(${ratings.tableScore})::float`,
			count: sql<number>`count(*)::int`
		})
		.from(ratings)
		.where(eq(ratings.tableId, tableId));

	return summary(row);
}

/** A GM's average across all their tables, and how many ratings that is. Computed, not stored. */
export async function gmRating(db: AnyDb, gmId: string) {
	const [row] = await db
		.select({
			average: sql<number | null>`avg(${ratings.gmScore})::float`,
			count: sql<number>`count(*)::int`
		})
		.from(ratings)
		.innerJoin(gameTables, eq(ratings.tableId, gameTables.id))
		.where(eq(gameTables.gmId, gmId));

	return summary(row);
}
