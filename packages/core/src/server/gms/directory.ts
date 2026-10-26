import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, gmScores, profiles, systems, userBadges } from '../db/schema';
import type { HeldBadge } from '../badges/reads';
import { escapeLike, folded, openSql, published } from '../directories/sql';
import { gmRatings, type GmRating } from '../ratings/service';
import { GM_SCORE } from '../../ratings/gm-score';
import { foldText } from '../../systems/directory-filters';
import { GM_DIRECTORY_PAGE_SIZE, type GmDirectoryFilters } from '../../gms/directory-filters';

/** How many systems a card names; the rest is a count. */
export const GM_CARD_SYSTEMS = 3;

/** The tables each person ran, one row per person: how many, the last one run, how many open. */
const statsOf = (db: AnyDb, now: Date) =>
  db
    .select({
      gmId: gameTables.gmId,
      tables: sql<number>`count(*)::int`.as('tables'),
      lastRunAt:
        sql<Date | null>`max(${gameTables.startsAt}) filter (where ${gameTables.startsAt} <= ${now.toISOString()}::timestamptz)`.as(
          'last_run_at',
        ),
      openTables: sql<number>`(count(*) filter (where ${openSql(now)}))::int`.as('open_tables'),
    })
    .from(gameTables)
    .where(published)
    .groupBy(gameTables.gmId)
    .as('stats');

/** Whether the person ran a public table that matches `condition`. */
const ranOne = (condition: SQL) =>
  sql`exists (select 1 from ${gameTables} where ${gameTables.gmId} = ${profiles.id} and ${published} and ${condition})`;

export type GmCardSystem = { name: string; slug: string; tables: number };

export type GmCard = {
  username: string;
  /** Only when the person chose to show it under the @usuário. */
  name: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
  bio: string | null;
  tableRole: 'gm' | 'both';
  rating: GmRating;
  /** Visible badges, or null while the badges are off. */
  badges: HeldBadge[] | null;
  tables: number;
  lastRunAt: Date | null;
  openTables: number;
  /** Most tables first, the first `GM_CARD_SYSTEMS`; `moreSystems` counts the rest. */
  systems: GmCardSystem[];
  moreSystems: number;
  modalities: ('online' | 'in_person')[];
  /** From the in-person tables they ran (the latest one), never from the profile. */
  city: string | null;
};

export type GmDirectoryList = { total: number; pages: number; people: GmCard[] };

/**
 * One page of Quem mestra (`/gamemasters`): active accounts with a username that answered "Mestra"
 * or "Joga e mestra", with what they ran (public tables only). Null for a page past the last one,
 * which the page answers with a 404.
 */
export async function listGmDirectory(
  db: AnyDb,
  filters: GmDirectoryFilters,
  now: Date,
  { showBadges = false }: { showBadges?: boolean } = {},
): Promise<GmDirectoryList | null> {
  const stats = statsOf(db, now);
  const tables = sql<number>`coalesce(${stats.tables}, 0)`;
  const openTables = sql<number>`coalesce(${stats.openTables}, 0)`;
  const needle = filters.query ? `%${escapeLike(foldText(filters.query))}%` : null;
  const where = and(
    eq(profiles.status, 'active'),
    isNotNull(profiles.username),
    inArray(profiles.tableRole, ['gm', 'both']),
    // The name is searched only where it is public.
    needle
      ? sql`(${folded(profiles.username)} like ${needle} or (${profiles.showName} and ${folded(profiles.name)} like ${needle}))`
      : undefined,
    filters.system
      ? ranOne(
          sql`${gameTables.systemId} = (select ${systems.id} from ${systems} where ${systems.slug} = ${filters.system})`,
        )
      : undefined,
    filters.modality ? ranOne(sql`${gameTables.modality} = ${filters.modality}`) : undefined,
    filters.open ? sql`${openTables} > 0` : undefined,
  );

  const [{ total }] = await db
    .select({ total: count() })
    .from(profiles)
    .leftJoin(stats, eq(stats.gmId, profiles.id))
    .where(where);
  const pages = Math.max(1, Math.ceil(total / GM_DIRECTORY_PAGE_SIZE));
  if (filters.page > pages) return null;

  // A score counts from GM_SCORE.minRatings ratings; below that the person is "Estreia".
  const score = sql`case when ${gmScores.count} >= ${GM_SCORE.minRatings} then ${gmScores.score} end`;
  const recent = sql`${stats.lastRunAt} desc nulls last`;
  const byName = asc(profiles.username);
  const order = {
    recent: [recent, desc(tables), byName],
    score: [sql`${score} desc nulls last`, recent, byName],
    tables: [desc(tables), recent, byName],
    name: [byName],
  }[filters.sort];
  const rows = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      name: profiles.name,
      showName: profiles.showName,
      avatarPath: profiles.avatarPath,
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
      tableRole: profiles.tableRole,
      tables,
      lastRunAt: stats.lastRunAt,
      openTables,
    })
    .from(profiles)
    .leftJoin(stats, eq(stats.gmId, profiles.id))
    .leftJoin(gmScores, eq(gmScores.gmId, profiles.id))
    .where(where)
    .orderBy(...order)
    .limit(GM_DIRECTORY_PAGE_SIZE)
    .offset((filters.page - 1) * GM_DIRECTORY_PAGE_SIZE);

  const ids = rows.map((row) => row.id);
  const [ratings, systemsRun, details, badges] = await Promise.all([
    gmRatings(db, ids, now),
    systemsOf(db, ids),
    tableDetails(db, ids),
    showBadges ? badgesOf(db, ids) : null,
  ]);

  return {
    total,
    pages,
    people: rows.map((row) => {
      const ran = systemsRun.get(row.id) ?? [];
      const detail = details.get(row.id);
      return {
        username: row.username!,
        name: (row.showName && row.name) || null,
        avatarPath: row.avatarPath,
        avatarUrl: row.avatarUrl,
        bio: row.bio,
        tableRole: row.tableRole as 'gm' | 'both',
        rating: ratings.get(row.id)!,
        badges: badges ? (badges.get(row.id) ?? []) : null,
        tables: row.tables,
        // postgres.js hands a computed timestamp back as text.
        lastRunAt: row.lastRunAt ? new Date(row.lastRunAt) : null,
        openTables: row.openTables,
        systems: ran.slice(0, GM_CARD_SYSTEMS),
        moreSystems: Math.max(0, ran.length - GM_CARD_SYSTEMS),
        modalities: detail?.modalities ?? [],
        city: detail?.city ?? null,
      };
    }),
  };
}

/** The systems each person ran, most tables first. */
async function systemsOf(db: AnyDb, gmIds: string[]) {
  const found = new Map<string, GmCardSystem[]>();
  if (gmIds.length === 0) return found;
  const rows = await db
    .select({
      gmId: gameTables.gmId,
      name: systems.name,
      slug: systems.slug,
      tables: sql<number>`count(*)::int`,
    })
    .from(gameTables)
    .innerJoin(systems, eq(systems.id, gameTables.systemId))
    .where(and(published, inArray(gameTables.gmId, gmIds), eq(systems.status, 'approved')))
    .groupBy(gameTables.gmId, systems.name, systems.slug)
    .orderBy(gameTables.gmId, desc(sql`count(*)`), asc(systems.name));
  for (const { gmId, ...system } of rows) found.set(gmId, [...(found.get(gmId) ?? []), system]);
  return found;
}

/** Where each person's tables happened, and the city of the latest in-person one. */
async function tableDetails(db: AnyDb, gmIds: string[]) {
  const found = new Map<string, { modalities: ('online' | 'in_person')[]; city: string | null }>();
  if (gmIds.length === 0) return found;
  const rows = await db
    .select({
      gmId: gameTables.gmId,
      modalities: sql<
        ('online' | 'in_person')[]
      >`array_agg(distinct ${gameTables.modality}::text order by ${gameTables.modality}::text)`,
      city: sql<
        string | null
      >`(array_agg(${gameTables.locationCity} order by ${gameTables.startsAt} desc) filter (where ${gameTables.modality} = 'in_person' and ${gameTables.locationCity} is not null))[1]`,
    })
    .from(gameTables)
    .where(and(published, inArray(gameTables.gmId, gmIds)))
    .groupBy(gameTables.gmId);
  for (const { gmId, modalities, city } of rows) found.set(gmId, { modalities, city });
  return found;
}

/** The badges each person shows: not revoked, not hidden by them. */
async function badgesOf(db: AnyDb, gmIds: string[]) {
  const found = new Map<string, HeldBadge[]>();
  if (gmIds.length === 0) return found;
  const rows = await db
    .select({
      profileId: userBadges.profileId,
      badgeId: userBadges.badgeId,
      awardedAt: userBadges.awardedAt,
      sourceEventId: userBadges.sourceEventId,
      grantedBy: userBadges.grantedBy,
    })
    .from(userBadges)
    .where(
      and(
        inArray(userBadges.profileId, gmIds),
        isNull(userBadges.revokedAt),
        eq(userBadges.hidden, false),
      ),
    )
    .orderBy(desc(userBadges.awardedAt), asc(userBadges.badgeId));
  for (const { profileId, sourceEventId, grantedBy, ...badge } of rows)
    found.set(profileId, [
      ...(found.get(profileId) ?? []),
      { ...badge, hidden: false, backfilled: sourceEventId === null && grantedBy === null },
    ]);
  return found;
}
