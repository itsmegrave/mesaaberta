import { and, eq, type SQL } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, profiles, systems } from '../db/schema';
import { nextOccurrence, weeklyInterval } from './schedule';

/**
 * Seats still free. `taken` is the number of confirmed registrations; until registrations exist
 * (#11) nobody can have joined, so every table has all its seats.
 */
export const seatsLeft = (capacity: number, taken = 0) => Math.max(0, capacity - taken);

const columns = {
	slug: gameTables.slug,
	title: gameTables.title,
	kind: gameTables.kind,
	description: gameTables.description,
	extraInfo: gameTables.extraInfo,
	imagePath: gameTables.imagePath,
	capacity: gameTables.capacity,
	startsAt: gameTables.startsAt,
	durationMinutes: gameTables.durationMinutes,
	timezone: gameTables.timezone,
	recurrence: gameTables.recurrence,
	until: gameTables.until,
	joinMode: gameTables.joinMode,
	systemName: systems.name,
	systemSlug: systems.slug,
	gmName: profiles.displayName
};

export type TableView = ReturnType<typeof shape>;

const query = (db: AnyDb, where: SQL | undefined) =>
	db
		.select(columns)
		.from(gameTables)
		.innerJoin(systems, eq(gameTables.systemId, systems.id))
		.innerJoin(profiles, eq(gameTables.gmId, profiles.id))
		.where(where);

type Row = Awaited<ReturnType<typeof query>>[number];

const shape = (row: Row, now: Date) => {
	const { systemName, systemSlug, ...table } = row;

	return {
		...table,
		system: { name: systemName, slug: systemSlug },
		seatsLeft: seatsLeft(row.capacity),
		// Weeks between sessions for a weekly campaign; null for a one-shot.
		everyWeeks: row.kind === 'campaign' ? weeklyInterval(row.recurrence) : null,
		nextAt: nextOccurrence(row, now)
	};
};

// A disabled table is invisible to the public, whatever else is true of it: both queries below
// filter on status.

/**
 * Active tables that still have a session ahead, soonest first. A one-shot that is over, or a
 * campaign past its end date, is left out. `systemSlug` narrows the list to one system.
 */
export async function listUpcomingTables(
	db: AnyDb,
	now: Date,
	{ systemSlug }: { systemSlug?: string } = {}
): Promise<TableView[]> {
	const rows = await query(
		db,
		and(eq(gameTables.status, 'active'), systemSlug ? eq(systems.slug, systemSlug) : undefined)
	);

	return rows
		.map((row) => shape(row, now))
		.filter((table) => table.nextAt !== null)
		.sort((a, b) => a.nextAt!.getTime() - b.nextAt!.getTime());
}

/**
 * The active table at this slug, or null if there is none or it is disabled. A table whose sessions
 * are over is still found (`nextAt` is null), so an old shared link keeps working.
 */
export async function findTableBySlug(
	db: AnyDb,
	slug: string,
	now: Date
): Promise<TableView | null> {
	const [row] = await query(db, and(eq(gameTables.slug, slug), eq(gameTables.status, 'active')));

	return row ? shape(row, now) : null;
}
