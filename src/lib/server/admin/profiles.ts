import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { profiles } from '../db/schema';
import { profileFilters } from '$lib/admin/profile-filters';

export async function listAdminProfiles(db: AnyDb, params: URLSearchParams) {
  const filters = profileFilters(params);
  const search = filters.query.replace(/[\\%_]/g, '\\$&');
  const where = and(
    filters.status === 'all' ? undefined : eq(profiles.status, filters.status),
    search ? ilike(profiles.username, `%${search}%`) : undefined,
  );
  const [count] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(profiles)
    .where(where);
  const page = Math.min(filters.page, Math.max(1, Math.ceil(count.total / filters.pageSize)));
  const rows = await db
    .select({ id: profiles.id, username: profiles.username, status: profiles.status })
    .from(profiles)
    .where(where)
    .orderBy(desc(profiles.createdAt), desc(profiles.id))
    .limit(filters.pageSize)
    .offset((page - 1) * filters.pageSize);
  return { rows, total: count.total, ...filters, page };
}

export type AdminProfiles = Awaited<ReturnType<typeof listAdminProfiles>>;

export async function adminProfile(db: AnyDb, id: string) {
  const [profile] = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      name: profiles.name,
      status: profiles.status,
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
