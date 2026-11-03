import { and, asc, count, desc, eq, gte, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, profiles, registrations, systems, userBadges } from '../db/schema';
import { recordEvent } from '../events/outbox';
import { reviewRange } from '../../profile/year-review';

/** How many systems the Retrospectiva names. */
export const REVIEW_SYSTEMS = 3;

export type YearReview = {
  year: number;
  /** Concluded tables they had a confirmed seat at (not as the GM). */
  played: number;
  /** Concluded tables they ran. */
  ran: number;
  /** The systems of those tables, most tables first. */
  systems: { name: string; slug: string; tables: number }[];
  /** Different people they shared a table with. */
  companions: number;
  /** The GM they played with most, from two tables on. */
  topGm: { username: string; tables: number } | null;
  /** The month (1 to 12) with the most tables, Brasília time; null with none. */
  busiestMonth: number | null;
  /** Badges they earned that year and still hold. */
  badges: number;
};

/**
 * A person's year at the tables. Counts concluded tables only, the same as "Mesas jogadas" on the
 * profile: a table counts once, on the day it starts.
 */
export async function yearReview(db: AnyDb, profileId: string, year: number): Promise<YearReview> {
  const { from, to } = reviewRange(year);
  const inYear = and(
    eq(gameTables.status, 'concluded'),
    gte(gameTables.startsAt, from),
    lt(gameTables.startsAt, to),
  );
  const [played, ran] = await Promise.all([
    db
      .select({ id: registrations.tableId })
      .from(registrations)
      .innerJoin(gameTables, eq(gameTables.id, registrations.tableId))
      .where(
        and(
          eq(registrations.playerId, profileId),
          eq(registrations.status, 'confirmed'),
          ne(gameTables.gmId, profileId),
          inYear,
        ),
      ),
    db
      .select({ id: gameTables.id })
      .from(gameTables)
      .where(and(eq(gameTables.gmId, profileId), inYear)),
  ]);
  const tableIds = [...played.map((row) => row.id), ...ran.map((row) => row.id)];
  if (tableIds.length === 0)
    return {
      year,
      played: 0,
      ran: 0,
      systems: [],
      companions: 0,
      topGm: null,
      busiestMonth: null,
      badges: await badgesIn(db, profileId, from, to),
    };

  const month = sql<number>`extract(month from ${gameTables.startsAt} at time zone 'America/Sao_Paulo')::int`;
  const [systemRows, players, gms, months, badges] = await Promise.all([
    db
      .select({ name: systems.name, slug: systems.slug, tables: sql<number>`count(*)::int` })
      .from(gameTables)
      .innerJoin(systems, eq(systems.id, gameTables.systemId))
      .where(and(inArray(gameTables.id, tableIds), eq(systems.status, 'approved')))
      .groupBy(systems.name, systems.slug)
      .orderBy(desc(sql`count(*)`), asc(systems.name))
      .limit(REVIEW_SYSTEMS),
    db
      .selectDistinct({ id: registrations.playerId })
      .from(registrations)
      .where(and(inArray(registrations.tableId, tableIds), eq(registrations.status, 'confirmed'))),
    db
      .select({
        id: gameTables.gmId,
        username: profiles.username,
        status: profiles.status,
        tables: sql<number>`count(*)::int`,
      })
      .from(gameTables)
      .innerJoin(profiles, eq(profiles.id, gameTables.gmId))
      .where(inArray(gameTables.id, tableIds))
      .groupBy(gameTables.gmId, profiles.username, profiles.status)
      .orderBy(desc(sql`count(*)`), asc(profiles.username)),
    db
      .select({ month, tables: count() })
      .from(gameTables)
      .where(inArray(gameTables.id, tableIds))
      .groupBy(month)
      .orderBy(desc(count()), asc(month))
      .limit(1),
    badgesIn(db, profileId, from, to),
  ]);
  const people = new Set([...players.map((row) => row.id), ...gms.map((row) => row.id)]);
  people.delete(profileId);
  const [top] = gms.filter(
    (gm) => gm.id !== profileId && gm.status === 'active' && gm.username && gm.tables >= 2,
  );
  return {
    year,
    played: played.length,
    ran: ran.length,
    systems: systemRows,
    companions: people.size,
    topGm: top ? { username: top.username!, tables: top.tables } : null,
    busiestMonth: months[0]?.month ?? null,
    badges,
  };
}

async function badgesIn(db: AnyDb, profileId: string, from: Date, to: Date) {
  const [row] = await db
    .select({ total: count() })
    .from(userBadges)
    .where(
      and(
        eq(userBadges.profileId, profileId),
        isNull(userBadges.revokedAt),
        gte(userBadges.awardedAt, from),
        lt(userBadges.awardedAt, to),
      ),
    );
  return row.total;
}

/**
 * The Retrospectiva of `username` for `viewerId`: their own always, someone else's only when they
 * made it public. Null for an unknown or inactive person, or one that is private to this viewer.
 */
export async function readYearReview(
  db: AnyDb,
  username: string,
  year: number,
  viewerId: string | null,
) {
  const [person] = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      name: profiles.name,
      showName: profiles.showName,
      avatarPath: profiles.avatarPath,
      avatarUrl: profiles.avatarUrl,
      status: profiles.status,
      shared: profiles.yearReviewPublic,
    })
    .from(profiles)
    .where(eq(sql`lower(${profiles.username})`, username.toLowerCase()));
  if (!person || person.status !== 'active') return null;
  const own = person.id === viewerId;
  if (!own && !person.shared) return null;
  return {
    person: {
      username: person.username!,
      name: (person.showName && person.name) || null,
      avatarPath: person.avatarPath,
      avatarUrl: person.avatarUrl,
    },
    own,
    shared: person.shared,
    review: await yearReview(db, person.id, year),
  };
}

/** "Deixar pública": anyone with the link can open the person's Retrospectiva, or only they. */
export async function shareYearReview(db: AnyDb, profileId: string, shared: boolean) {
  await db.update(profiles).set({ yearReviewPublic: shared }).where(eq(profiles.id, profileId));
  const eventId = await recordEvent(db, {
    type: 'YearReviewShared',
    actorId: profileId,
    payload: { profileId, shared },
  });
  return { eventIds: [eventId] };
}
