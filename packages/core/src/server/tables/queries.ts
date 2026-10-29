import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  ne,
  notExists,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import {
  follows,
  gameTables,
  places,
  profileFavoriteSystems,
  profiles,
  registrations,
  systems,
} from '../db/schema';
import { publicName } from '../db/public-name';
import { reservedSeatsSql } from '../invitations/seats';
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
  plannedSessions: gameTables.plannedSessions,
  safetyTools: gameTables.safetyTools,
  contentRating: gameTables.contentRating,
  startsAt: gameTables.startsAt,
  durationMinutes: gameTables.durationMinutes,
  timezone: gameTables.timezone,
  recurrence: gameTables.recurrence,
  until: gameTables.until,
  joinMode: gameTables.joinMode,
  modality: gameTables.modality,
  locationArea: gameTables.locationArea,
  // The "Onde jogar" place it happens at, while that place is listed; its name for the card.
  placeId: gameTables.placeId,
  placeName: sql<
    string | null
  >`(select ${places.name} from ${places} where ${places.id} = ${gameTables.placeId} and ${places.approvedAt} is not null and ${places.removedAt} is null and ${places.hiddenAt} is null)`,
  systemName: systems.name,
  systemSlug: systems.slug,
  // Seats taken: confirmed registrations only. A pending request takes none.
  taken: sql<number>`(select count(*)::int from ${registrations} where ${registrations.tableId} = ${gameTables.id} and ${registrations.status} = 'confirmed')`,
  gmName: publicName(profiles.username),
  // The GM's picture (still a storage path or the provider's URL: the caller makes it a URL) and
  // their name, only when they chose to show it, for the card's byline.
  gmAvatarPath: profiles.avatarPath,
  gmAvatarUrl: profiles.avatarUrl,
  gmShownName: sql<
    string | null
  >`case when ${profiles.showName} then nullif(${profiles.name}, '') end`,
  gmId: gameTables.gmId,
  status: gameTables.status,
  publishedAt: gameTables.publishedAt,
};

export type TableView = ReturnType<typeof shape> & {
  platforms: { name: string; slug: string }[];
  tags: { name: string; slug: string }[];
  /** The GM's score, the same everywhere it is shown. */
  gmRating: GmRating;
};

const query = (db: AnyDb, where: SQL | undefined, now: Date, newestFirst = false) =>
  db
    .select({ ...columns, reserved: reservedSeatsSql(gameTables.id, now) })
    .from(gameTables)
    .innerJoin(systems, eq(gameTables.systemId, systems.id))
    .innerJoin(profiles, eq(gameTables.gmId, profiles.id))
    .where(where)
    // Soonest first, or most recently published first; the slug keeps ties in a steady order.
    .orderBy(
      ...(newestFirst ? [desc(gameTables.publishedAt)] : [gameTables.startsAt]),
      gameTables.slug,
    );

type Row = Awaited<ReturnType<typeof query>>[number];

const shape = (row: Row) => {
  const { systemName, systemSlug, ...table } = row;

  return {
    ...table,
    system: { name: systemName, slug: systemSlug },
    seatsLeft: seatsLeft(row.capacity, row.taken + row.reserved),
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
 * session begins. `systemSlug` narrows the list to one system, `placeId` to one "Onde jogar" place.
 */
export async function listUpcomingTables(
  db: AnyDb,
  now: Date,
  { systemSlug, placeId, limit }: { systemSlug?: string; placeId?: string; limit?: number } = {},
): Promise<TableView[]> {
  const where = and(
    eq(gameTables.status, 'active'),
    gt(gameTables.startsAt, now),
    systemSlug ? eq(systems.slug, systemSlug) : undefined,
    placeId ? eq(gameTables.placeId, placeId) : undefined,
  );
  const rows = await (limit === undefined
    ? query(db, where, now)
    : query(db, where, now).limit(limit));

  return withExtras(db, rows.map(shape), now);
}

// How far back "Novas mesas" looks.
export const NEW_TABLE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Tables published in the last `NEW_TABLE_DAYS` that have not started and still have a seat,
 * most recently published first, at most `limit`. The window starts from `now`, so a caller
 * that rounds `now` (see `publicReadNow`) keeps the query's parameters stable for caching.
 */
export async function listNewTables(db: AnyDb, now: Date, limit: number): Promise<TableView[]> {
  const since = new Date(now.getTime() - NEW_TABLE_DAYS * DAY_MS);
  const rows = await query(
    db,
    and(
      eq(gameTables.status, 'active'),
      gt(gameTables.startsAt, now),
      gte(gameTables.publishedAt, since),
    ),
    now,
    true,
  );
  const open = rows.map(shape).filter((table) => table.seatsLeft > 0);

  return withExtras(db, open.slice(0, limit), now);
}

/**
 * The candidates for the three table rows of a signed-in Início in one query: open tables that
 * have not started, by someone the person follows, in one of their favorite systems, or published
 * in the last `NEW_TABLE_DAYS`. Their own tables and the ones they already joined or asked to join
 * are left out, and so are tables with no seat left. Soonest first, without the platforms, tags and
 * GM score: the caller sorts them into rows and adds those (`withExtras`) only for what it shows.
 */
export async function listHomeCandidates(
  db: AnyDb,
  personId: string,
  now: Date,
  { follows: withFollows }: { follows: boolean },
) {
  const since = new Date(now.getTime() - NEW_TABLE_DAYS * DAY_MS);
  const followed = db
    .select({ id: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, personId));
  const favorites = db
    .select({ id: profileFavoriteSystems.systemId })
    .from(profileFavoriteSystems)
    .where(eq(profileFavoriteSystems.profileId, personId));
  const rows = await query(
    db,
    and(
      eq(gameTables.status, 'active'),
      gt(gameTables.startsAt, now),
      ne(gameTables.gmId, personId),
      notExists(
        db
          .select({ one: sql`1` })
          .from(registrations)
          .where(
            and(eq(registrations.tableId, gameTables.id), eq(registrations.playerId, personId)),
          ),
      ),
      or(
        withFollows ? inArray(gameTables.gmId, followed) : undefined,
        inArray(gameTables.systemId, favorites),
        gte(gameTables.publishedAt, since),
      ),
    ),
    now,
  );
  return { since, tables: rows.map(shape).filter((table) => table.seatsLeft > 0) };
}

/** A master's public upcoming tables, soonest first, one page of them and the total. */
export async function listUpcomingTablesByGm(
  db: AnyDb,
  gmId: string,
  now: Date,
  page: number,
  pageSize: number,
) {
  const where = and(
    eq(gameTables.gmId, gmId),
    eq(gameTables.status, 'active'),
    gt(gameTables.startsAt, now),
  );
  // Only the page is read; the total is counted on its own.
  const [rows, [{ total }]] = await Promise.all([
    query(db, where, now)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(gameTables).where(where),
  ]);
  return { total, tables: await withExtras(db, rows.map(shape), now) };
}

/**
 * Adds each table's approved platforms and tags, and its GM's score: one query for the catalogue
 * and one for all the GMs on the page, so a list does not cost a query per table.
 */
export async function withExtras<T extends { id: string; gmId: string }>(
  db: AnyDb,
  list: T[],
  now: Date,
) {
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
 *
 * A draft is found only for `viewer` when that is its GM or an admin: to everyone else, and to a
 * caller that names no viewer (the Instagram publisher), it does not exist.
 */
export async function findTableBySlug(
  db: AnyDb,
  slug: string,
  now: Date,
  viewer?: { id: string; admin: boolean } | null,
): Promise<TableView | null> {
  const [row] = await query(
    db,
    and(eq(gameTables.slug, slug), ne(gameTables.status, 'disabled')),
    now,
  );
  if (!row) return null;
  const table = shape(row);
  if (table.status === 'draft' && !(viewer && (viewer.admin || viewer.id === table.gmId)))
    return null;

  return (await withExtras(db, [table], now))[0];
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
