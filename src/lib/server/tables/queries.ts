import { and, eq, gt, ne, sql, type SQL } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, profiles, registrations, systems } from '../db/schema';
import { publicName } from '../db/public-name';
import { weeklyInterval } from './schedule';
import { catalogOf } from '../catalog';
import { gmRatings, type GmRating } from '../ratings/service';

/** Seats still free: the capacity minus the confirmed registrations. */
export const seatsLeft = (capacity: number, taken = 0) => Math.max(0, capacity - taken);

const columns = {
  id: gameTables.id,
  slug: gameTables.slug,
  title: gameTables.title,
  kind: gameTables.kind,
  description: gameTables.description,
  extraInfo: gameTables.extraInfo,
  imagePath: gameTables.imagePath,
  capacity: gameTables.capacity,
  minPlayers: gameTables.minPlayers,
  startsAt: gameTables.startsAt,
  durationMinutes: gameTables.durationMinutes,
  timezone: gameTables.timezone,
  recurrence: gameTables.recurrence,
  until: gameTables.until,
  joinMode: gameTables.joinMode,
  modality: gameTables.modality,
  locationArea: gameTables.locationArea,
  systemName: systems.name,
  systemSlug: systems.slug,
  // Seats taken: confirmed registrations only. A pending request takes none.
  taken: sql<number>`(select count(*)::int from ${registrations} where ${registrations.tableId} = ${gameTables.id} and ${registrations.status} = 'confirmed')`,
  gmName: publicName(profiles.username),
  gmId: gameTables.gmId,
  status: gameTables.status,
};

export type TableView = ReturnType<typeof shape> & {
  platforms: { name: string; slug: string }[];
  tags: { name: string; slug: string }[];
  /** The GM's score, the same everywhere it is shown. */
  gmRating: GmRating;
};

const query = (db: AnyDb, where: SQL | undefined) =>
  db
    .select(columns)
    .from(gameTables)
    .innerJoin(systems, eq(gameTables.systemId, systems.id))
    .innerJoin(profiles, eq(gameTables.gmId, profiles.id))
    .where(where)
    // Soonest first; the slug keeps tables that start together in a steady order.
    .orderBy(gameTables.startsAt, gameTables.slug);

type Row = Awaited<ReturnType<typeof query>>[number];

const shape = (row: Row) => {
  const { systemName, systemSlug, ...table } = row;

  return {
    ...table,
    system: { name: systemName, slug: systemSlug },
    seatsLeft: seatsLeft(row.capacity, row.taken),
    // Weeks between sessions for a weekly campaign; null for a one-shot. Information only: the
    // platform keeps one date per table, `startsAt`.
    everyWeeks: row.kind === 'campaign' ? weeklyInterval(row.recurrence) : null,
  };
};

// A disabled table is invisible to the public, whatever else is true of it: both queries below
// filter on status. Only an active table that has not started is listed; one past its start
// (awaiting the GM's confirmation, concluded or not held) is still found by its slug.

/**
 * Active tables that have not started yet, soonest first. A table leaves the list the moment its
 * session begins. `systemSlug` narrows the list to one system.
 */
export async function listUpcomingTables(
  db: AnyDb,
  now: Date,
  { systemSlug }: { systemSlug?: string } = {},
): Promise<TableView[]> {
  const rows = await query(
    db,
    and(
      eq(gameTables.status, 'active'),
      gt(gameTables.startsAt, now),
      systemSlug ? eq(systems.slug, systemSlug) : undefined,
    ),
  );

  return withExtras(db, rows.map(shape), now);
}

/** A master's public upcoming tables, soonest first, one page of them and the total. */
export async function listUpcomingTablesByGm(
  db: AnyDb,
  gmId: string,
  now: Date,
  page: number,
  pageSize: number,
) {
  const rows = await query(
    db,
    and(eq(gameTables.gmId, gmId), eq(gameTables.status, 'active'), gt(gameTables.startsAt, now)),
  );
  const upcoming = rows.map(shape);
  return {
    total: upcoming.length,
    tables: await withExtras(db, upcoming.slice((page - 1) * pageSize, page * pageSize), now),
  };
}

/**
 * Adds each table's approved platforms and tags, and its GM's score: one query for the catalogue
 * and one for all the GMs on the page, so a list does not cost a query per table.
 */
async function withExtras<T extends { id: string; gmId: string }>(db: AnyDb, list: T[], now: Date) {
  const [catalog, scores] = await Promise.all([
    catalogOf(
      db,
      list.map((table) => table.id),
    ),
    gmRatings(
      db,
      list.map((table) => table.gmId),
      now,
    ),
  ]);
  return list.map((table) => ({
    ...table,
    ...catalog.get(table.id)!,
    gmRating: scores.get(table.gmId)!,
  }));
}

/**
 * The table at this slug, or null if there is none or it is disabled. A table whose session has
 * begun is still found (its status says where it stands), so an old shared link keeps working.
 */
export async function findTableBySlug(
  db: AnyDb,
  slug: string,
  now: Date,
): Promise<TableView | null> {
  const [row] = await query(db, and(eq(gameTables.slug, slug), ne(gameTables.status, 'disabled')));

  return row ? (await withExtras(db, [shape(row)], now))[0] : null;
}

/**
 * How to join a table (the link or the address). Private: call it only for the GM and the
 * confirmed players; the public queries above never select it.
 */
export async function joinDetailsOf(db: AnyDb, tableId: string): Promise<string | null> {
  const [row] = await db
    .select({ joinDetails: gameTables.joinDetails })
    .from(gameTables)
    .where(eq(gameTables.id, tableId));

  return row?.joinDetails ?? null;
}
