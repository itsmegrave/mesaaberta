import { desc, eq, sql, type SQL } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import {
  events,
  gameTables,
  platforms,
  profiles,
  registrations,
  systems,
  tags,
} from '../db/schema';

const countWhere = (condition: SQL) =>
  sql<number>`count(*) filter (where ${condition})`.mapWith(Number);

export async function adminOverview(db: AnyDb, now = new Date()) {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [people, tables, seats, queue, platformSuggestions, tagSuggestions, recentTables] =
    await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`.mapWith(Number),
          active: countWhere(sql`${profiles.status} = 'active'`),
          suspended: countWhere(sql`${profiles.status} = 'suspended'`),
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
      db
        .select({
          slug: gameTables.slug,
          title: gameTables.title,
          status: gameTables.status,
          system: systems.name,
          createdAt: gameTables.createdAt,
        })
        .from(gameTables)
        .innerJoin(systems, eq(systems.id, gameTables.systemId))
        .orderBy(desc(gameTables.createdAt), desc(gameTables.id))
        .limit(5),
    ]);
  return {
    people: people[0],
    tables: tables[0],
    seats: seats[0],
    queue: queue[0],
    suggestions: { platforms: platformSuggestions[0].count, tags: tagSuggestions[0].count },
    recentTables,
    updatedAt: now,
  };
}
