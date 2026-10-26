import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, profiles, systems } from '../db/schema';
import { publicName } from '../db/public-name';
import { activeGm, escapeLike, folded, openSql, published } from '../directories/sql';
import { gmRatings, type GmRating } from '../ratings/service';
import { listUpcomingTables } from '../tables/queries';
import {
  SYSTEM_DIRECTORY_PAGE_SIZE,
  foldText,
  type SystemDirectoryFilters,
} from '../../systems/directory-filters';

/** The counts of every system with a public table, one row per system. */
const statsOf = (db: AnyDb, now: Date) =>
  db
    .select({
      systemId: gameTables.systemId,
      openTables: sql<number>`(count(*) filter (where ${openSql(now)}))::int`.as('open_tables'),
      totalTables: sql<number>`count(*)::int`.as('total_tables'),
      gmCount: sql<number>`(count(distinct ${gameTables.gmId}) filter (where ${activeGm}))::int`.as(
        'gm_count',
      ),
    })
    .from(gameTables)
    .innerJoin(profiles, eq(profiles.id, gameTables.gmId))
    .where(published)
    .groupBy(gameTables.systemId)
    .as('stats');

export type SystemFacts = { openTables: number; totalTables: number; gmCount: number };
export type DirectoryPerson = {
  username: string;
  avatarPath: string | null;
  avatarUrl: string | null;
};

/** Up to `limit` people who run each system, most tables of it first; banned accounts left out. */
async function topGms(db: AnyDb, systemIds: string[], limit: number) {
  if (systemIds.length === 0)
    return new Map<string, (DirectoryPerson & { gmId: string; tables: number })[]>();
  const ranked = db
    .select({
      systemId: gameTables.systemId,
      gmId: gameTables.gmId,
      tables: sql<number>`count(*)::int`.as('tables'),
      rank: sql<number>`row_number() over (partition by ${gameTables.systemId} order by count(*) desc, ${gameTables.gmId})`.as(
        'rank',
      ),
    })
    .from(gameTables)
    .innerJoin(profiles, eq(profiles.id, gameTables.gmId))
    .where(and(published, inArray(gameTables.systemId, systemIds), activeGm))
    .groupBy(gameTables.systemId, gameTables.gmId)
    .as('ranked');
  const rows = await db
    .select({
      systemId: ranked.systemId,
      gmId: ranked.gmId,
      tables: ranked.tables,
      username: publicName(profiles.username),
      avatarPath: profiles.avatarPath,
      avatarUrl: profiles.avatarUrl,
    })
    .from(ranked)
    .innerJoin(profiles, eq(profiles.id, ranked.gmId))
    .where(sql`${ranked.rank} <= ${limit}`)
    .orderBy(ranked.systemId, ranked.rank);
  const bySystem = new Map<string, (DirectoryPerson & { gmId: string; tables: number })[]>();
  for (const { systemId, ...gm } of rows) {
    bySystem.set(systemId, [...(bySystem.get(systemId) ?? []), gm]);
  }
  return bySystem;
}

/**
 * One page of the game systems directory (`/systems`): approved systems only, with how many
 * tables each has open now, how many it has had, how many people run it and up to four of them.
 * Null for a page past the last one, which the page answers with a 404.
 */
export async function listSystemDirectory(db: AnyDb, filters: SystemDirectoryFilters, now: Date) {
  const stats = statsOf(db, now);
  const openTables = sql<number>`coalesce(${stats.openTables}, 0)`;
  const totalTables = sql<number>`coalesce(${stats.totalTables}, 0)`;
  const needle = filters.query ? `%${escapeLike(foldText(filters.query))}%` : null;
  const where = and(
    eq(systems.status, 'approved'),
    filters.show === 'open' ? sql`${openTables} > 0` : undefined,
    needle ? sql`${folded(systems.name)} like ${needle}` : undefined,
  );

  const [{ total }] = await db
    .select({ total: count() })
    .from(systems)
    .leftJoin(stats, eq(stats.systemId, systems.id))
    .where(where);
  const pages = Math.max(1, Math.ceil(total / SYSTEM_DIRECTORY_PAGE_SIZE));
  if (filters.page > pages) return null;

  const order = {
    open: [desc(openTables), asc(systems.position), asc(systems.name)],
    played: [desc(totalTables), asc(systems.position), asc(systems.name)],
    az: [asc(sql`lower(${systems.name})`), asc(systems.name)],
  }[filters.sort];
  const rows = await db
    .select({
      id: systems.id,
      name: systems.name,
      slug: systems.slug,
      openTables,
      totalTables,
      gmCount: sql<number>`coalesce(${stats.gmCount}, 0)`,
    })
    .from(systems)
    .leftJoin(stats, eq(stats.systemId, systems.id))
    .where(where)
    .orderBy(...order)
    .limit(SYSTEM_DIRECTORY_PAGE_SIZE)
    .offset((filters.page - 1) * SYSTEM_DIRECTORY_PAGE_SIZE);

  const gms = await topGms(
    db,
    rows.map((row) => row.id),
    4,
  );
  return {
    total,
    pages,
    systems: rows.map(({ id, ...system }) => ({
      ...system,
      gms: (gms.get(id) ?? []).map(({ username, avatarPath, avatarUrl }) => ({
        username,
        avatarPath,
        avatarUrl,
      })),
    })),
  };
}

export type SystemDirectoryList = NonNullable<Awaited<ReturnType<typeof listSystemDirectory>>>;

// How many people the system page shows, and how many it weighs to pick them.
const PAGE_GMS = 6;
const RANKED_GMS = 24;
const PAGE_TABLES = 6;
const PAGE_ENDED = 3;

/**
 * Everything the page of one system (`/s/[slug]`) shows. Null when there is no approved system at
 * that slug (a draft, a rejected or a disabled one included); `{ redirectTo }` when it was merged
 * into another, so the old address moves to the new one.
 */
export async function readSystemPage(db: AnyDb, slug: string, now: Date) {
  const [found] = await db
    .select({
      id: systems.id,
      name: systems.name,
      slug: systems.slug,
      status: systems.status,
      mergedInto: systems.mergedInto,
    })
    .from(systems)
    .where(eq(systems.slug, slug));
  if (!found) return null;
  if (found.status !== 'approved') {
    if (!found.mergedInto) return null;
    // A merge can be merged again: follow it a few steps to the system that stands.
    let target = found.mergedInto;
    for (let hop = 0; hop < 5; hop++) {
      const [next] = await db
        .select({ slug: systems.slug, status: systems.status, mergedInto: systems.mergedInto })
        .from(systems)
        .where(eq(systems.id, target));
      if (!next) return null;
      if (next.status === 'approved') return { redirectTo: next.slug };
      if (!next.mergedInto) return null;
      target = next.mergedInto;
    }
    return null;
  }

  const stats = statsOf(db, now);
  const [facts, modalities, ranked, ended, openTables] = await Promise.all([
    db
      .select({
        openTables: stats.openTables,
        totalTables: stats.totalTables,
        gmCount: stats.gmCount,
      })
      .from(stats)
      .where(eq(stats.systemId, found.id)),
    db
      .selectDistinct({ modality: gameTables.modality })
      .from(gameTables)
      .where(and(published, eq(gameTables.systemId, found.id))),
    topGms(db, [found.id], RANKED_GMS),
    db
      .select({
        slug: gameTables.slug,
        title: gameTables.title,
        endedAt: gameTables.updatedAt,
        gmName: publicName(profiles.username),
      })
      .from(gameTables)
      .innerJoin(profiles, eq(profiles.id, gameTables.gmId))
      .where(
        and(
          eq(gameTables.systemId, found.id),
          eq(gameTables.status, 'concluded'),
          isNull(gameTables.moderatedAt),
        ),
      )
      .orderBy(desc(gameTables.updatedAt), gameTables.slug)
      .limit(PAGE_ENDED),
    listUpcomingTables(db, now, { systemSlug: found.slug, limit: PAGE_TABLES }),
  ]);

  // Most tables of this system first, then the better score.
  const people = ranked.get(found.id) ?? [];
  const scores = await gmRatings(
    db,
    people.map((gm) => gm.gmId),
    now,
  );
  const score = (rating: GmRating) => (rating.isNew ? -1 : (rating.score ?? -1));
  const gms = people
    .map(({ gmId, ...gm }) => ({ ...gm, rating: scores.get(gmId)! }))
    .sort((a, b) => b.tables - a.tables || score(b.rating) - score(a.rating))
    .slice(0, PAGE_GMS);

  return {
    system: { id: found.id, name: found.name, slug: found.slug },
    facts: (facts[0] ?? { openTables: 0, totalTables: 0, gmCount: 0 }) as SystemFacts,
    modalities: modalities.map((row) => row.modality).sort(),
    openTables: openTables.map(({ gmId, ...table }) => table),
    gms,
    ended,
  };
}

export type SystemPage = Exclude<
  Awaited<ReturnType<typeof readSystemPage>>,
  null | { redirectTo: string }
>;
