import { eq, sql, type SQL } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { events, gameTables, platforms, profiles, registrations, tags } from '../db/schema';

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
  return {
    people: people[0],
    tables: tables[0],
    seats: seats[0],
    queue: queue[0],
    suggestions: { platforms: platformSuggestions[0].count, tags: tagSuggestions[0].count },
    updatedAt: now,
  };
}
