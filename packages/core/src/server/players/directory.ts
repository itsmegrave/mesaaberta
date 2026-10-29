import { and, asc, count, desc, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { profileFavoriteSystems, profiles, systems } from '../db/schema';
import { escapeLike, folded } from '../directories/sql';
import { recordEvent } from '../events/outbox';
import { foldText } from '../../systems/directory-filters';
import {
  LOOKING_DAYS,
  PLAYERS_PAGE_SIZE,
  type LookingInput,
  type PlayerFilters,
} from '../../players/looking';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many favorite systems a card names; the rest is a count. */
export const PLAYER_CARD_SYSTEMS = 3;

export type PlayerCard = {
  username: string;
  /** Only when the person chose to show it under the @usuário. */
  name: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
  note: string | null;
  lookingSince: Date;
  /** Tables they played (confirmed, already started). */
  played: number;
  /** Their favorite systems, only when they show them on their profile. */
  systems: { name: string; slug: string }[];
  moreSystems: number;
};

export type PlayerDirectory = {
  total: number;
  pages: number;
  people: PlayerCard[];
  /** The systems someone listed has among the favorites they show, for the Sistema filter. */
  systems: { name: string; slug: string }[];
};

/** Listed: active, with a username, looking since less than `LOOKING_DAYS` ago. */
const listed = (now: Date) =>
  and(
    eq(profiles.status, 'active'),
    isNotNull(profiles.username),
    gte(profiles.lookingForTableAt, new Date(now.getTime() - LOOKING_DAYS * DAY_MS)),
  );

/** Whether the person shows `systemSlug` among their favorite systems. */
const favors = (systemSlug: string) =>
  sql`${profiles.showFavoriteSystems} and exists (select 1 from ${profileFavoriteSystems} inner join ${systems} on ${systems.id} = ${profileFavoriteSystems.systemId} where ${profileFavoriteSystems.profileId} = ${profiles.id} and ${systems.slug} = ${systemSlug})`;

/**
 * One page of Procuro mesa, the people looking for a table, newest first. Null for a page past the
 * last one, which the page answers with a 404.
 */
export async function listLookingPlayers(
  db: AnyDb,
  filters: PlayerFilters,
  now: Date,
): Promise<PlayerDirectory | null> {
  const needle = filters.query ? `%${escapeLike(foldText(filters.query))}%` : null;
  const where = and(
    listed(now),
    needle
      ? sql`(${folded(profiles.username)} like ${needle} or (${profiles.showName} and ${folded(profiles.name)} like ${needle}) or ${folded(profiles.lookingForTableNote)} like ${needle})`
      : undefined,
    filters.system ? favors(filters.system) : undefined,
  );
  const [{ total }] = await db.select({ total: count() }).from(profiles).where(where);
  const pages = Math.max(1, Math.ceil(total / PLAYERS_PAGE_SIZE));
  if (filters.page > pages) return null;

  const rows = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      name: profiles.name,
      showName: profiles.showName,
      avatarPath: profiles.avatarPath,
      avatarUrl: profiles.avatarUrl,
      note: profiles.lookingForTableNote,
      lookingSince: profiles.lookingForTableAt,
      showFavoriteSystems: profiles.showFavoriteSystems,
      // A one-table select leaves column names bare, so the subquery names its own tables.
      played: sql<number>`(select count(*)::int from registrations r inner join game_tables t on t.id = r.table_id where r.player_id = profiles.id and r.status = 'confirmed' and t.status not in ('draft', 'disabled') and t.moderated_at is null and t.starts_at <= ${now.toISOString()}::timestamptz)`,
    })
    .from(profiles)
    .where(where)
    .orderBy(desc(profiles.lookingForTableAt), asc(profiles.username))
    .limit(PLAYERS_PAGE_SIZE)
    .offset((filters.page - 1) * PLAYERS_PAGE_SIZE);

  const shown = rows.filter((row) => row.showFavoriteSystems).map((row) => row.id);
  const [favorites, options] = await Promise.all([
    favoritesOf(db, shown),
    lookingPlayerSystems(db, now),
  ]);
  return {
    total,
    pages,
    systems: options,
    people: rows.map((row) => {
      const liked = favorites.get(row.id) ?? [];
      return {
        username: row.username!,
        name: (row.showName && row.name) || null,
        avatarPath: row.avatarPath,
        avatarUrl: row.avatarUrl,
        note: row.note,
        lookingSince: row.lookingSince!,
        played: row.played,
        systems: liked.slice(0, PLAYER_CARD_SYSTEMS),
        moreSystems: Math.max(0, liked.length - PLAYER_CARD_SYSTEMS),
      };
    }),
  };
}

/** The favorite systems of each person, A to Z. */
async function favoritesOf(db: AnyDb, ids: string[]) {
  const found = new Map<string, { name: string; slug: string }[]>();
  if (ids.length === 0) return found;
  const rows = await db
    .select({
      profileId: profileFavoriteSystems.profileId,
      name: systems.name,
      slug: systems.slug,
    })
    .from(profileFavoriteSystems)
    .innerJoin(systems, eq(systems.id, profileFavoriteSystems.systemId))
    .where(and(inArray(profileFavoriteSystems.profileId, ids), eq(systems.status, 'approved')))
    .orderBy(asc(systems.name));
  for (const { profileId, ...system } of rows)
    found.set(profileId, [...(found.get(profileId) ?? []), system]);
  return found;
}

/** The systems the listed people show among their favorites, most people first. */
async function lookingPlayerSystems(db: AnyDb, now: Date) {
  return db
    .select({ name: systems.name, slug: systems.slug })
    .from(profileFavoriteSystems)
    .innerJoin(systems, eq(systems.id, profileFavoriteSystems.systemId))
    .innerJoin(profiles, eq(profiles.id, profileFavoriteSystems.profileId))
    .where(and(listed(now), eq(profiles.showFavoriteSystems, true), eq(systems.status, 'approved')))
    .groupBy(systems.name, systems.slug)
    .orderBy(desc(sql`count(*)`), asc(systems.name));
}

export type LookingState = { looking: boolean; since: Date | null; note: string };

/** The person's own "Estou procurando mesa": an old one past `LOOKING_DAYS` reads as off. */
export async function lookingOf(db: AnyDb, profileId: string, now: Date): Promise<LookingState> {
  const [row] = await db
    .select({ at: profiles.lookingForTableAt, note: profiles.lookingForTableNote })
    .from(profiles)
    .where(eq(profiles.id, profileId));
  const fresh = !!row?.at && row.at.getTime() >= now.getTime() - LOOKING_DAYS * DAY_MS;
  return { looking: fresh, since: fresh ? row!.at : null, note: row?.note ?? '' };
}

/**
 * Turns "Estou procurando mesa" on (again: the `LOOKING_DAYS` start over) or off. The note is kept
 * when it is turned off, so turning it back on starts from it.
 */
export async function setLooking(db: AnyDb, profileId: string, input: LookingInput, now: Date) {
  const { looking } = input;
  await db
    .update(profiles)
    .set({ lookingForTableAt: looking ? now : null, lookingForTableNote: input.note || null })
    .where(eq(profiles.id, profileId));
  const eventId = await recordEvent(db, {
    type: 'PlayerLookingChanged',
    actorId: profileId,
    payload: { profileId, looking },
  });
  return { eventIds: [eventId] };
}
