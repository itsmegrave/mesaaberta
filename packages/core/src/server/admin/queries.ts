import { asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { OPEN_REPORT_STATUSES } from '../../moderation/reports';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import {
  events,
  gameTables,
  instagramPosts,
  platforms,
  playerRatings,
  profiles,
  ratings,
  registrations,
  reports,
  systems,
  tags,
} from '@mesaaberta/core/server/db/schema';
import { listQueue } from './catalog';
import { matchGraphStats } from '../matches/graph';
import { standingWhere } from './profiles';

const countWhere = (condition: SQL) =>
  sql<number>`count(*) filter (where ${condition})`.mapWith(Number);

export async function adminOverview(db: AnyDb, now = new Date()) {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recently = (column: typeof ratings.createdAt | typeof playerRatings.createdAt) =>
    countWhere(
      sql`${column} >= ${since.toISOString()}::timestamptz and ${column} <= ${now.toISOString()}::timestamptz`,
    );
  const [
    people,
    tables,
    seats,
    queue,
    platformSuggestions,
    tagSuggestions,
    gmRatings,
    playerRatingRows,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        active: countWhere(standingWhere.active),
        // A temporary ban, a ban that never ends and an account its owner closed, apart.
        suspended: countWhere(standingWhere.suspended),
        banned: countWhere(standingWhere.banned),
        closed: countWhere(standingWhere.closed),
        new30d: countWhere(
          sql`${profiles.createdAt} >= ${since.toISOString()}::timestamptz and ${profiles.createdAt} <= ${now.toISOString()}::timestamptz`,
        ),
      })
      .from(profiles),
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        active: countWhere(sql`${gameTables.status} = 'active'`),
        disabled: countWhere(sql`${gameTables.status} = 'disabled'`),
        awaiting: countWhere(sql`${gameTables.status} = 'awaiting_confirmation'`),
        concluded: countWhere(sql`${gameTables.status} = 'concluded'`),
        notHeld: countWhere(sql`${gameTables.status} = 'not_held'`),
        draft: countWhere(sql`${gameTables.status} = 'draft'`),
        online: countWhere(sql`${gameTables.modality} = 'online'`),
        inPerson: countWhere(sql`${gameTables.modality} = 'in_person'`),
        gms: sql<number>`count(distinct ${gameTables.gmId})`.mapWith(Number),
      })
      .from(gameTables),
    db
      .select({
        confirmed: countWhere(sql`${registrations.status} = 'confirmed'`),
        pending: countWhere(sql`${registrations.status} = 'pending'`),
      })
      .from(registrations),
    db
      .select({
        pending: countWhere(sql`${events.processedAt} is null and ${events.failedAt} is null`),
        failed: countWhere(sql`${events.failedAt} is not null`),
      })
      .from(events),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(platforms)
      .where(eq(platforms.status, 'pending')),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(tags)
      .where(eq(tags.status, 'pending')),
    // Players rating the GM of a table they played at.
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        new30d: recently(ratings.createdAt),
      })
      .from(ratings),
    // GMs rating the players they marked present.
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        new30d: recently(playerRatings.createdAt),
      })
      .from(playerRatings),
  ]);
  const [oldestReport, uncertainPosts, suggestions, recent] = await Promise.all([
    db
      .select({ createdAt: reports.createdAt })
      .from(reports)
      .where(inArray(reports.status, [...OPEN_REPORT_STATUSES]))
      .orderBy(asc(reports.createdAt))
      .limit(1),
    db
      .select({ title: gameTables.title })
      .from(instagramPosts)
      .innerJoin(gameTables, eq(gameTables.id, instagramPosts.tableId))
      .where(eq(instagramPosts.status, 'uncertain'))
      .orderBy(asc(instagramPosts.createdAt)),
    listQueue(db),
    db
      .select({
        id: gameTables.id,
        slug: gameTables.slug,
        title: gameTables.title,
        status: gameTables.status,
        system: systems.name,
        gm: profiles.username,
        gmId: profiles.id,
        imagePath: gameTables.imagePath,
        startsAt: gameTables.startsAt,
        kind: gameTables.kind,
        timezone: gameTables.timezone,
      })
      .from(gameTables)
      .innerJoin(systems, eq(systems.id, gameTables.systemId))
      .innerJoin(profiles, eq(profiles.id, gameTables.gmId))
      .orderBy(desc(gameTables.createdAt), desc(gameTables.id))
      .limit(5),
  ]);
  return {
    // What waits on an admin, with the one thing worth naming about each: the oldest report, the
    // first post to check, and how many suggestions repeat an entry the catalog already has. A table
    // waiting for its GM to confirm is the GM's to do, not an admin's, so it is not listed here.
    attention: {
      reports: { oldestAt: oldestReport[0]?.createdAt ?? null },
      posts: { count: uncertainPosts.length, first: uncertainPosts[0]?.title ?? null },
      suggestions: {
        platforms: suggestions.filter((entry) => entry.kind === 'platform').length,
        tags: suggestions.filter((entry) => entry.kind === 'tag').length,
        duplicates: suggestions.filter((entry) => entry.duplicateOf).length,
      },
    },
    recent,
    people: people[0],
    // Combinar's community map: counts only, never names.
    combinar: await matchGraphStats(db, now),
    tables: tables[0],
    seats: seats[0],
    // Both kinds of rating on the platform, counted apart: counts only, never scores or comments.
    ratings: {
      total: gmRatings[0].total + playerRatingRows[0].total,
      new30d: gmRatings[0].new30d + playerRatingRows[0].new30d,
      ofGms: gmRatings[0].total,
      ofPlayers: playerRatingRows[0].total,
    },
    queue: queue[0],
    suggestions: { platforms: platformSuggestions[0].count, tags: tagSuggestions[0].count },
    updatedAt: now,
  };
}
