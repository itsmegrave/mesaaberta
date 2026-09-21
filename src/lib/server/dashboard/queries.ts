import { and, asc, eq, inArray } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, profiles, ratings, registrations, systems } from '../db/schema';
import { publicName } from '../db/public-name';
import { rateBlocker } from '../auth/policy';
import { firstSessionEnded } from '../ratings/service';
import { nextOccurrence } from '../tables/schedule';
import { seatsLeft } from '../tables/queries';

// The "My tables" page: what I play in, and what I run. Sessions coming up come first, soonest
// first; a table with no session left goes last.
const byNextSession = <T extends { nextAt: Date | null }>(items: T[]) =>
	items.sort((a, b) => (a.nextAt?.getTime() ?? Infinity) - (b.nextAt?.getTime() ?? Infinity));

/** The tables where this person has a seat or a pending request. */
export async function listPlaying(db: AnyDb, playerId: string, now: Date) {
	const gm = profiles;
	const rows = await db
		.select({
			slug: gameTables.slug,
			title: gameTables.title,
			kind: gameTables.kind,
			startsAt: gameTables.startsAt,
			durationMinutes: gameTables.durationMinutes,
			timezone: gameTables.timezone,
			recurrence: gameTables.recurrence,
			until: gameTables.until,
			tableStatus: gameTables.status,
			gmId: gameTables.gmId,
			gmName: publicName(gm.username),
			systemName: systems.name,
			status: registrations.status,
			tableScore: ratings.tableScore,
			gmScore: ratings.gmScore
		})
		.from(registrations)
		.innerJoin(gameTables, eq(registrations.tableId, gameTables.id))
		.innerJoin(systems, eq(gameTables.systemId, systems.id))
		.innerJoin(gm, eq(gameTables.gmId, gm.id))
		.leftJoin(
			ratings,
			and(eq(ratings.tableId, registrations.tableId), eq(ratings.playerId, registrations.playerId))
		)
		.where(eq(registrations.playerId, playerId));

	const actor = { id: playerId, role: 'member', status: 'active' } as const;

	return byNextSession(
		rows.map((row) => ({
			slug: row.slug,
			title: row.title,
			systemName: row.systemName,
			gmName: row.gmName,
			status: row.status,
			tableStatus: row.tableStatus,
			timezone: row.timezone,
			nextAt: nextOccurrence(row, now),
			// The prompt to rate: a confirmed seat, and the first session is over.
			canRate:
				rateBlocker(actor, {
					gmId: row.gmId,
					registration: row.status,
					firstSessionEnded: firstSessionEnded(row, now)
				}) === null,
			rating:
				row.tableScore === null || row.gmScore === null
					? null
					: { tableScore: row.tableScore, gmScore: row.gmScore }
		}))
	);
}

/** The tables this person is the GM of, with who has a seat and who is waiting. */
export async function listRunning(db: AnyDb, gmId: string, now: Date) {
	const tables = await db
		.select()
		.from(gameTables)
		.where(eq(gameTables.gmId, gmId))
		.orderBy(asc(gameTables.startsAt));
	if (tables.length === 0) return [];

	const people = await db
		.select({
			tableId: registrations.tableId,
			playerId: registrations.playerId,
			username: publicName(profiles.username),
			status: registrations.status
		})
		.from(registrations)
		.innerJoin(profiles, eq(registrations.playerId, profiles.id))
		.where(
			inArray(
				registrations.tableId,
				tables.map((table) => table.id)
			)
		)
		.orderBy(asc(registrations.createdAt), asc(profiles.username));

	return byNextSession(
		tables.map((table) => {
			const mine = people.filter((person) => person.tableId === table.id);
			const players = mine
				.filter((person) => person.status === 'confirmed')
				.map(({ playerId, username }) => ({ playerId, username }));
			const requests = mine
				.filter((person) => person.status === 'pending')
				.map(({ playerId, username }) => ({ playerId, username }));

			return {
				slug: table.slug,
				title: table.title,
				tableStatus: table.status,
				joinMode: table.joinMode,
				capacity: table.capacity,
				seatsLeft: seatsLeft(table.capacity, players.length),
				timezone: table.timezone,
				nextAt: nextOccurrence(table, now),
				players,
				requests
			};
		})
	);
}
