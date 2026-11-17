import { and, asc, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, placeHosts, places, profiles, systems } from '../db/schema';
import { published } from '../directories/sql';

// Who runs games at a place and what they play there, for its page: "Quem mestra aqui" and
// "Sistemas jogados aqui". Both come from the place's house GMs and its tables of the last
// PLACE_HISTORY_DAYS; nobody types them in.

/** How far back a place's tables count. */
export const PLACE_HISTORY_DAYS = 365;
/** How many people "Quem mestra aqui" shows before "Ver todas as pessoas". */
export const PLACE_GMS_SHOWN = 6;
/** How many systems "Sistemas jogados aqui" lists. */
export const PLACE_SYSTEMS_SHOWN = 8;

const since = (now: Date) => new Date(now.getTime() - PLACE_HISTORY_DAYS * 86_400_000);
const ranHere = (placeId: string, now: Date) =>
  and(eq(gameTables.placeId, placeId), published, gte(gameTables.startsAt, since(now)));

/** A person under "Quem mestra aqui": the name only where they chose to show it. */
export type PlaceGm = {
  username: string;
  name: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
  /** Named by the place, and accepted ("Mestra na casa"). */
  house: boolean;
  /** Tables they ran here in the last year. */
  tables: number;
};

/**
 * "Quem mestra aqui": the house GMs first (in the order they joined), then whoever ran a public
 * table here in the last year (most tables first), each once; the first PLACE_GMS_SHOWN and how
 * many there are in all. Only active accounts with a username.
 */
export async function placeGms(
  db: AnyDb,
  placeId: string,
  now: Date,
): Promise<{ people: PlaceGm[]; total: number }> {
  const person = {
    id: profiles.id,
    username: profiles.username,
    name: profiles.name,
    showName: profiles.showName,
    avatarPath: profiles.avatarPath,
    avatarUrl: profiles.avatarUrl,
  };
  const listed = and(eq(profiles.status, 'active'), isNotNull(profiles.username));
  const [house, ran] = await Promise.all([
    db
      .select(person)
      .from(placeHosts)
      .innerJoin(profiles, eq(profiles.id, placeHosts.profileId))
      .where(and(eq(placeHosts.placeId, placeId), listed))
      .orderBy(asc(placeHosts.createdAt)),
    db
      .select({ ...person, tables: sql<number>`count(*)::int` })
      .from(gameTables)
      .innerJoin(profiles, eq(profiles.id, gameTables.gmId))
      .where(and(ranHere(placeId, now), listed))
      .groupBy(profiles.id)
      .orderBy(desc(sql`count(*)`), asc(profiles.username)),
  ]);
  const tables = new Map(ran.map((row) => [row.id, row.tables]));
  const shape = (row: (typeof house)[number], isHouse: boolean): PlaceGm => ({
    username: row.username!,
    name: (row.showName && row.name) || null,
    avatarPath: row.avatarPath,
    avatarUrl: row.avatarUrl,
    house: isHouse,
    tables: tables.get(row.id) ?? 0,
  });
  const houseIds = new Set(house.map((row) => row.id));
  const everyone = [
    ...house.map((row) => shape(row, true)),
    ...ran.filter((row) => !houseIds.has(row.id)).map((row) => shape(row, false)),
  ];
  return { people: everyone.slice(0, PLACE_GMS_SHOWN), total: everyone.length };
}

/** "Sistemas jogados aqui": the systems of the place's public tables of the last year, most first. */
export async function placeSystems(db: AnyDb, placeId: string, now: Date) {
  return db
    .select({ slug: systems.slug, name: systems.name, tables: sql<number>`count(*)::int` })
    .from(gameTables)
    .innerJoin(systems, eq(systems.id, gameTables.systemId))
    .where(ranHere(placeId, now))
    .groupBy(systems.id)
    .orderBy(desc(sql`count(*)`), asc(systems.name))
    .limit(PLACE_SYSTEMS_SHOWN);
}

/** Whether a person is one of the place's people: a house GM or ran a table there in the last year. */
export const atPlace = (slug: string, now: Date) =>
  sql`(exists (select 1 from ${placeHosts} join ${places} on ${places.id} = ${placeHosts.placeId} where ${placeHosts.profileId} = ${profiles.id} and ${places.slug} = ${slug}) or exists (select 1 from ${gameTables} join ${places} on ${places.id} = ${gameTables.placeId} where ${gameTables.gmId} = ${profiles.id} and ${places.slug} = ${slug} and ${published} and ${gameTables.startsAt} >= ${since(now).toISOString()}::timestamptz))`;
