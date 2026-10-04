import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, systems, instagramPosts, profiles } from '../db/schema';
import { tableFilters, type InstagramFilter } from '$lib/admin/table-filters';
import { TABLE_STATUSES, type TableStatus } from '$lib/tables/status-values';

/** The posts the filter names; `none` is a table that never had one, or one that was skipped. */
const instagramWhere = (filter: InstagramFilter): SQL | undefined => {
  switch (filter) {
    case 'all':
      return undefined;
    case 'published':
      return eq(instagramPosts.status, 'published');
    case 'queued':
      return inArray(instagramPosts.status, ['queued', 'processing', 'publishing']);
    case 'uncertain':
      return eq(instagramPosts.status, 'uncertain');
    case 'failed':
      return eq(instagramPosts.status, 'failed');
    case 'none':
      return or(isNull(instagramPosts.status), eq(instagramPosts.status, 'skipped'));
  }
};

export async function listAdminTables(db: AnyDb, params: URLSearchParams) {
  const filters = tableFilters(params);
  const search = filters.query.replace(/[\\%_]/g, '\\$&');
  // The segmented filter counts what each status would show with the other filters kept.
  const others = and(
    search
      ? or(
          ilike(gameTables.title, `%${search}%`),
          ilike(systems.name, `%${search}%`),
          ilike(profiles.username, `%${search}%`),
        )
      : undefined,
    instagramWhere(filters.instagram),
  );
  const where = and(
    filters.status === 'all' ? undefined : eq(gameTables.status, filters.status),
    others,
  );
  const counted = await db
    .select({ status: gameTables.status, total: sql<number>`count(*)`.mapWith(Number) })
    .from(gameTables)
    .innerJoin(systems, eq(systems.id, gameTables.systemId))
    .innerJoin(profiles, eq(profiles.id, gameTables.gmId))
    .leftJoin(instagramPosts, eq(instagramPosts.tableId, gameTables.id))
    .where(others)
    .groupBy(gameTables.status);
  const counts = Object.fromEntries(
    TABLE_STATUSES.map((status) => [
      status,
      counted.find((row) => row.status === status)?.total ?? 0,
    ]),
  ) as Record<TableStatus, number>;
  const all = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const total = filters.status === 'all' ? all : counts[filters.status];
  const page = Math.min(filters.page, Math.max(1, Math.ceil(total / filters.pageSize)));
  const { id: sortId, dir } = filters.sort;
  const direction = dir === 'asc' ? asc : desc;
  const columns = {
    id: gameTables.id,
    slug: gameTables.slug,
    title: gameTables.title,
    status: gameTables.status,
    system: systems.name,
    gm: profiles.username,
    gmId: profiles.id,
    imagePath: gameTables.imagePath,
    capacity: gameTables.capacity,
    seats:
      sql<number>`(select count(*) from registrations r where r.table_id = "game_tables"."id" and r.status = 'confirmed')`.mapWith(
        Number,
      ),
    startsAt: gameTables.startsAt,
    kind: gameTables.kind,
    timezone: gameTables.timezone,
    instagramStatus: instagramPosts.status,
    permalink: instagramPosts.permalink,
  };
  const listed = () =>
    db
      .select(columns)
      .from(gameTables)
      .innerJoin(systems, eq(systems.id, gameTables.systemId))
      .innerJoin(profiles, eq(profiles.id, gameTables.gmId))
      .leftJoin(instagramPosts, eq(instagramPosts.tableId, gameTables.id))
      .where(where);
  const offset = (page - 1) * filters.pageSize;
  // `next` is the session date: a table has one, `startsAt`.
  const sortColumn =
    sortId === 'title'
      ? gameTables.title
      : sortId === 'next'
        ? gameTables.startsAt
        : gameTables.createdAt;
  const rows = await listed()
    .orderBy(direction(sortColumn), direction(gameTables.id))
    .limit(filters.pageSize)
    .offset(offset);
  return {
    rows,
    total,
    counts: { all, ...counts },
    ...filters,
    page,
  };
}
export type AdminTables = Awaited<ReturnType<typeof listAdminTables>>;

/** One table as the admin's page about it shows it: who runs it, its one date, where it stands. */
export async function adminTable(db: AnyDb, id: string) {
  const [row] = await db
    .select({
      id: gameTables.id,
      slug: gameTables.slug,
      title: gameTables.title,
      status: gameTables.status,
      system: systems.name,
      gm: profiles.username,
      gmId: profiles.id,
      startsAt: gameTables.startsAt,
      timezone: gameTables.timezone,
      capacity: gameTables.capacity,
    })
    .from(gameTables)
    .innerJoin(systems, eq(systems.id, gameTables.systemId))
    .innerJoin(profiles, eq(profiles.id, gameTables.gmId))
    .where(eq(gameTables.id, id))
    .limit(1);
  return row ?? null;
}
