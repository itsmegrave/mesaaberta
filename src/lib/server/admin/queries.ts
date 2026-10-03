import { asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { OPEN_REPORT_STATUSES } from '$lib/moderation/reports';
import type { AnyDb } from '../db/client';
import {
  events,
  gameTables,
  instagramPosts,
  platforms,
  profiles,
  registrations,
  reports,
  systems,
  tags,
} from '../db/schema';
import { nextOccurrence } from '../tables/schedule';
import { listQueue } from './catalog';

const countWhere = (condition: SQL) =>
  sql<number>`count(*) filter (where ${condition})`.mapWith(Number);

export async function adminOverview(db: AnyDb, now = new Date()) {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [people, tables, seats, queue, platformSuggestions, tagSuggestions] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        active: countWhere(sql`${profiles.status} = 'active'`),
        // A ban that never ends is "banned"; the rest of the suspended (a ban with an end date, or a
        // closed account) are "suspended".
        banned: countWhere(
          sql`${profiles.status} = 'suspended' and ${profiles.bannedAt} is not null and ${profiles.bannedUntil} is null`,
        ),
        suspended: countWhere(
          sql`${profiles.status} = 'suspended' and not (${profiles.bannedAt} is not null and ${profiles.bannedUntil} is null)`,
        ),
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
  ]);
  const [oldestReport, uncertainPosts, awaitingTables, suggestions, recent] = await Promise.all([
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
    db
      .select({
        title: gameTables.title,
        startsAt: gameTables.startsAt,
        timezone: gameTables.timezone,
      })
      .from(gameTables)
      .where(eq(gameTables.status, 'awaiting_confirmation'))
      .orderBy(asc(gameTables.startsAt)),
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
        recurrence: gameTables.recurrence,
        until: gameTables.until,
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
    // first post to check, the table that waits longest for its GM, and how many suggestions repeat
    // an entry the catalog already has.
    attention: {
      reports: { oldestAt: oldestReport[0]?.createdAt ?? null },
      posts: { count: uncertainPosts.length, first: uncertainPosts[0]?.title ?? null },
      awaiting: {
        count: awaitingTables.length,
        first: awaitingTables[0]
          ? {
              title: awaitingTables[0].title,
              startsAt: awaitingTables[0].startsAt,
              timezone: awaitingTables[0].timezone,
            }
          : null,
      },
      suggestions: {
        platforms: suggestions.filter((entry) => entry.kind === 'platform').length,
        tags: suggestions.filter((entry) => entry.kind === 'tag').length,
        duplicates: suggestions.filter((entry) => entry.duplicateOf).length,
      },
    },
    recent: recent.map((row) => ({ ...row, nextAt: nextOccurrence(row, now) })),
    people: people[0],
    tables: tables[0],
    seats: seats[0],
    queue: queue[0],
    suggestions: { platforms: platformSuggestions[0].count, tags: tagSuggestions[0].count },
    updatedAt: now,
  };
}
