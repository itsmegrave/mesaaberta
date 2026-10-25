// Relative imports only, and nothing from SvelteKit: extensions run this in the web app, the api
// and the background Worker alike.
import {
  and,
  count,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  lte,
  not,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { activeAdmins } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { gameTables, profiles, registrations } from '../db/schema';

/**
 * The groups of people an extension can aim something at (a poll, Trello #231). GM is not a role:
 * anyone signed in can open a table, so each group is worked out from what the app already keeps.
 *
 * - `admin`: an admin account.
 * - `gm`: has opened a table, as the announcements' `game_masters` count it.
 * - `player`: has a confirmed seat.
 * - `recent`: played or ran a session (a table that went ahead or still will) in the last 90 days.
 * - `new`: the account is younger than 30 days.
 */
export const SEGMENTS = ['admin', 'gm', 'player', 'recent', 'new'] as const;
export type Segment = (typeof SEGMENTS)[number];
export type ViewerSegments = Readonly<Record<Segment, boolean>>;

export const RECENT_DAYS = 90;
export const NEW_MEMBER_DAYS = 30;

const DAY_MS = 86_400_000;

/** The tables whose session counts for `recent`: published and not called off. */
const HELD = ['active', 'awaiting_confirmation', 'concluded'] as const;

/** A table with a session between `since` and `now`; a campaign counts until its last session. */
const sessionBetween = (since: Date, now: Date) =>
  and(
    inArray(gameTables.status, HELD),
    lte(gameTables.startsAt, now),
    or(
      gte(gameTables.startsAt, since),
      and(
        sql`${gameTables.recurrence} is not null`,
        or(isNull(gameTables.until), gte(gameTables.until, since)),
      ),
    ),
  );

/** The condition on `profiles` for one segment, at `now`. */
export function segmentWhere(segment: Segment, now: Date = new Date()): SQL {
  switch (segment) {
    case 'admin':
      return activeAdmins()!;
    case 'gm':
      return exists(sql`(select 1 from ${gameTables} where ${gameTables.gmId} = ${profiles.id})`);
    case 'player':
      return exists(
        sql`(select 1 from ${registrations} where ${registrations.playerId} = ${profiles.id} and ${registrations.status} = 'confirmed')`,
      );
    case 'recent': {
      const since = new Date(now.getTime() - RECENT_DAYS * DAY_MS);
      const held = sessionBetween(since, now);
      return or(
        exists(
          sql`(select 1 from ${gameTables} where ${gameTables.gmId} = ${profiles.id} and ${held})`,
        ),
        exists(
          sql`(select 1 from ${registrations} join ${gameTables} on ${gameTables.id} = ${registrations.tableId} where ${registrations.playerId} = ${profiles.id} and ${registrations.status} = 'confirmed' and ${held})`,
        ),
      )!;
    }
    case 'new':
      return gte(profiles.createdAt, new Date(now.getTime() - NEW_MEMBER_DAYS * DAY_MS));
  }
}

/** Who can be aimed at at all: an active account that finished onboarding (it has a username). */
const reachable = () => and(eq(profiles.status, 'active'), sql`${profiles.username} is not null`)!;

/**
 * The segments one person is in, in one query, or null when nothing should be aimed at them
 * (no such profile, suspended, or still onboarding).
 */
export async function viewerSegments(
  db: AnyDb,
  profileId: string,
  now: Date = new Date(),
): Promise<ViewerSegments | null> {
  const columns = Object.fromEntries(
    SEGMENTS.map((segment) => [segment, sql<boolean>`(${segmentWhere(segment, now)})`.as(segment)]),
  ) as Record<Segment, SQL.Aliased<boolean>>;
  const [row] = await db
    .select(columns)
    .from(profiles)
    .where(and(eq(profiles.id, profileId), reachable()));
  return row
    ? (Object.fromEntries(SEGMENTS.map((s) => [s, row[s] === true])) as ViewerSegments)
    : null;
}

/** An audience: anyone in at least one `include` segment (everyone when empty), minus `exclude`. */
export type Audience = { include: readonly Segment[]; exclude: readonly Segment[] };

/** Whether a person with these segments is in the audience. */
export function inAudience(segments: ViewerSegments, audience: Audience): boolean {
  const included = audience.include.length === 0 || audience.include.some((s) => segments[s]);
  return included && !audience.exclude.some((s) => segments[s]);
}

/** How many people the audience reaches right now (the reach an admin sees before publishing). */
export async function countAudience(
  db: AnyDb,
  audience: Audience,
  now: Date = new Date(),
): Promise<number> {
  const include = audience.include.map((s) => segmentWhere(s, now));
  const exclude = audience.exclude.map((s) => not(segmentWhere(s, now)));
  const [row] = await db
    .select({ total: count() })
    .from(profiles)
    .where(and(reachable(), include.length ? or(...include) : undefined, ...exclude));
  return row?.total ?? 0;
}
