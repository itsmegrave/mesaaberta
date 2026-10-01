import { and, eq, ne, sql, type SQL } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, profiles, registrations, systems } from '../db/schema';
import { publicName } from '../db/public-name';
import { nextOccurrence, weeklyInterval } from './schedule';
import { catalogOf } from '../catalog';

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
};

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
    seatsLeft: seatsLeft(row.capacity, row.taken),
    // Weeks between sessions for a weekly campaign; null for a one-shot.
    everyWeeks: row.kind === 'campaign' ? weeklyInterval(row.recurrence) : null,
    nextAt: nextOccurrence(row, now),
  };
};

// A disabled table is invisible to the public, whatever else is true of it: both queries below
// filter on status. Only an active table is listed; one past its session (awaiting the GM's
// confirmation, concluded or not held) is still found by its slug.

/**
 * Active tables that still have a session ahead, soonest first. A one-shot that is over, or a
 * campaign past its end date, is left out. `systemSlug` narrows the list to one system.
 */
export async function listUpcomingTables(
  db: AnyDb,
  now: Date,
  { systemSlug }: { systemSlug?: string } = {},
): Promise<TableView[]> {
  const rows = await query(
    db,
    and(eq(gameTables.status, 'active'), systemSlug ? eq(systems.slug, systemSlug) : undefined),
  );

  const upcoming = rows
    .map((row) => shape(row, now))
    .filter((table) => table.nextAt !== null)
    .sort((a, b) => a.nextAt!.getTime() - b.nextAt!.getTime());
  return withCatalog(db, upcoming);
}

/** Adds each table's approved platforms and tags. */
async function withCatalog<T extends { id: string }>(db: AnyDb, list: T[]) {
  const catalog = await catalogOf(
    db,
    list.map((table) => table.id),
  );
  return list.map((table) => ({ ...table, ...catalog.get(table.id)! }));
}

/**
 * The table at this slug, or null if there is none or it is disabled. A table whose session is
 * over is still found (`nextAt` is null, and its status says where it stands), so an old shared
 * link keeps working.
 */
export async function findTableBySlug(
  db: AnyDb,
  slug: string,
  now: Date,
): Promise<TableView | null> {
  const [row] = await query(db, and(eq(gameTables.slug, slug), ne(gameTables.status, 'disabled')));

  return row ? (await withCatalog(db, [shape(row, now)]))[0] : null;
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
