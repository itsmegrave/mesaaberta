import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, systems, instagramPosts } from '../db/schema';
import { tableFilters } from '$lib/admin/table-filters';
import { nextOccurrence } from '../tables/schedule';
export async function listAdminTables(db: AnyDb, params: URLSearchParams, now = new Date()) {
  const filters = tableFilters(params);
  const search = filters.query.replace(/[\\%_]/g, '\\$&');
  const where = and(
    filters.status === 'all' ? undefined : eq(gameTables.status, filters.status),
    search ? ilike(gameTables.title, `%${search}%`) : undefined,
  );
  const [count] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(gameTables)
    .where(where);
  const page = Math.min(filters.page, Math.max(1, Math.ceil(count.total / filters.pageSize)));
  const rows = await db
    .select({
      id: gameTables.id,
      slug: gameTables.slug,
      title: gameTables.title,
      status: gameTables.status,
      system: systems.name,
      startsAt: gameTables.startsAt,
      kind: gameTables.kind,
      recurrence: gameTables.recurrence,
      until: gameTables.until,
      timezone: gameTables.timezone,
      instagramStatus: instagramPosts.status,
      permalink: instagramPosts.permalink,
    })
    .from(gameTables)
    .innerJoin(systems, eq(systems.id, gameTables.systemId))
    .leftJoin(instagramPosts, eq(instagramPosts.tableId, gameTables.id))
    .where(where)
    .orderBy(desc(gameTables.createdAt), desc(gameTables.id))
    .limit(filters.pageSize)
    .offset((page - 1) * filters.pageSize);
  return {
    rows: rows.map((row) => ({ ...row, nextAt: nextOccurrence(row, now) })),
    total: count.total,
    ...filters,
    page,
  };
}
export type AdminTables = Awaited<ReturnType<typeof listAdminTables>>;
