import { and, asc, desc, eq, ilike, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { profiles } from '../db/schema';
import { gmRatingOf } from '../ratings/service';
import { standingOf } from '$lib/profile/standing';
import { profileFilters } from '$lib/admin/profile-filters';

export async function listAdminProfiles(db: AnyDb, params: URLSearchParams) {
  const filters = profileFilters(params);
  const search = filters.query.replace(/[\\%_]/g, '\\$&');
  const banned = and(
    eq(profiles.status, 'suspended'),
    isNotNull(profiles.bannedAt),
    isNull(profiles.bannedUntil),
  );
  const byStanding: Record<'active' | 'suspended' | 'banned', SQL | undefined> = {
    active: eq(profiles.status, 'active'),
    // Suspended: a ban with an end date, or a closed account. Banned: a ban that never ends.
    suspended: and(eq(profiles.status, 'suspended'), sql`not coalesce(${banned}, false)`),
    banned,
  };
  const matching = search ? ilike(profiles.username, `%${search}%`) : undefined;
  const where = and(filters.status === 'all' ? undefined : byStanding[filters.status], matching);
  // The segmented filter counts what each standing would show with the search kept.
  const [counted] = await db
    .select({
      all: sql<number>`count(*)`.mapWith(Number),
      active: sql<number>`count(*) filter (where ${byStanding.active})`.mapWith(Number),
      suspended: sql<number>`count(*) filter (where ${byStanding.suspended})`.mapWith(Number),
      banned: sql<number>`count(*) filter (where ${banned})`.mapWith(Number),
    })
    .from(profiles)
    .where(matching);
  const total = filters.status === 'all' ? counted.all : counted[filters.status];
  const page = Math.min(filters.page, Math.max(1, Math.ceil(total / filters.pageSize)));
  const direction = filters.sort.dir === 'asc' ? asc : desc;
  const rows = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      name: profiles.name,
      status: profiles.status,
      bannedAt: profiles.bannedAt,
      bannedUntil: profiles.bannedUntil,
      createdAt: profiles.createdAt,
      avatarPath: profiles.avatarPath,
      avatarUrl: profiles.avatarUrl,
      // What they play in (a confirmed seat at an active table) and what they run (active tables).
      playing:
        sql<number>`(select count(*) from registrations r join game_tables t on t.id = r.table_id where r.player_id = "profiles"."id" and r.status = 'confirmed' and t.status = 'active')`.mapWith(
          Number,
        ),
      running:
        sql<number>`(select count(*) from game_tables t where t.gm_id = "profiles"."id" and t.status = 'active')`.mapWith(
          Number,
        ),
    })
    .from(profiles)
    .where(where)
    .orderBy(
      filters.sort.id === 'user'
        ? direction(sql`lower(coalesce(${profiles.username}, ''))`)
        : direction(profiles.createdAt),
      direction(profiles.id),
    )
    .limit(filters.pageSize)
    .offset((page - 1) * filters.pageSize);
  return {
    rows: rows.map(({ bannedAt, bannedUntil, ...row }) => ({
      ...row,
      standing: standingOf({ status: row.status, bannedAt, bannedUntil }),
    })),
    total,
    counts: counted,
    ...filters,
    page,
  };
}

export type AdminProfiles = Awaited<ReturnType<typeof listAdminProfiles>>;

export async function adminProfile(db: AnyDb, id: string) {
  const [profile] = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      name: profiles.name,
      status: profiles.status,
      bannedAt: profiles.bannedAt,
      bannedUntil: profiles.bannedUntil,
      city: profiles.city,
      timezone: profiles.timezone,
      createdAt: profiles.createdAt,
      updatedAt: profiles.updatedAt,
      avatarPath: profiles.avatarPath,
      avatarUrl: profiles.avatarUrl,
    })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1);
  return profile ?? null;
}

/**
 * What a person does on the platform, for the admin's page about them: the tables they play in and
 * run (active ones), how the players rated them as a GM, and the reports accepted against the
 * tables they run.
 */
export async function adminActivity(db: AnyDb, id: string) {
  const [row] = await db
    .select({
      playing:
        sql<number>`(select count(*) from registrations r join game_tables t on t.id = r.table_id where r.player_id = "profiles"."id" and r.status = 'confirmed' and t.status = 'active')`.mapWith(
          Number,
        ),
      running:
        sql<number>`(select count(*) from game_tables t where t.gm_id = "profiles"."id" and t.status = 'active')`.mapWith(
          Number,
        ),
    })
    .from(profiles)
    .where(eq(profiles.id, id));
  // The score the players and the GM see: the same weighted, cached value, never a plain average.
  return {
    playing: row?.playing ?? 0,
    running: row?.running ?? 0,
    rating: await gmRatingOf(db, id),
  };
}
