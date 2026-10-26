import { and, desc, eq, gte, isNotNull, isNull, sql } from 'drizzle-orm';
import { unionAll } from 'drizzle-orm/pg-core';
import type { AnyDb } from '../db/client';
import {
  follows,
  gameTables,
  notifications,
  playerInvitations,
  playerRatings,
  profileFavoriteSystems,
  profiles,
  registrations,
  systems,
  userBadges,
} from '../db/schema';
import { playerRatingOpen } from '../auth/policy';
import { listPlaying, listRunning } from '../dashboard/queries';
import { gmRatings, publicGmReviews } from '../ratings/service';
import { participantRatingOf } from '../ratings/players';
import { listHomeCandidates, withExtras, NEW_TABLE_DAYS } from '../tables/queries';
import { hasStarted } from '../tables/schedule';
import { listSystems } from '../systems';
import type { TableStatus } from '../../tables/status-values';

/** Each table row of the signed-in Início shows up to this many tables; "Veja mais" goes to /t. */
export const HOME_ROW_COUNT = 10;
/** Esperando você shows the most urgent of these; the phone cuts it further. */
export const HOME_WAITING_COUNT = 5;
export const HOME_SESSIONS_COUNT = 3;
export const HOME_FEED_COUNT = 6;
/** How far back "De quem você segue" looks. */
export const HOME_FEED_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type WaitingItem =
  | { kind: 'invitation'; id: string; slug: string; title: string; expiresAt: Date }
  | { kind: 'confirm'; slug: string; title: string }
  | { kind: 'requests'; slug: string; title: string; count: number }
  | { kind: 'rate_gm'; slug: string; title: string }
  | { kind: 'rate_players'; slug: string; title: string; count: number };

// Most urgent first: an invitation runs out, a session waits on the GM, people wait on an answer;
// ratings can wait.
const URGENCY: Record<WaitingItem['kind'], number> = {
  invitation: 0,
  confirm: 1,
  requests: 2,
  rate_gm: 3,
  rate_players: 4,
};

/**
 * Everything about the person that is not a table list, in one statement: what waits on them that
 * the dashboard lists do not carry (invitations, players to rate), the "Sua conta" counts, and who
 * and what they follow, so the caller can sort the table candidates into rows.
 */
async function personal(db: AnyDb, personId: string, now: Date) {
  const nowIso = now.toISOString();
  const [row] = await db
    .select({
      showFavoriteSystems: profiles.showFavoriteSystems,
      invitations: sql<{ id: string; slug: string; title: string; expiresAt: string }[]>`coalesce((
        select json_agg(json_build_object('id', i.id, 'slug', t.slug, 'title', t.title, 'expiresAt', i.expires_at) order by i.expires_at)
        from ${playerInvitations} i join ${gameTables} t on t.id = i.table_id
        where i.player_id = ${personId} and i.status = 'pending' and i.expires_at > ${nowIso}::timestamptz
      ), '[]'::json)`,
      // Seats the GM marked present and has not rated yet, by table; `playerRatingOpen` decides
      // which tables are open to it.
      toRate: sql<
        { slug: string; title: string; status: TableStatus; kind: string; count: number }[]
      >`coalesce((
        select json_agg(json_build_object('slug', t.slug, 'title', t.title, 'status', t.status, 'kind', t.kind, 'count', c.n) order by t.starts_at desc)
        from ${gameTables} t
        join lateral (
          select count(*)::int as n from ${registrations} r
          where r.table_id = t.id and r.status = 'confirmed' and r.attended = true
            and not exists (select 1 from ${playerRatings} pr where pr.table_id = t.id and pr.player_id = r.player_id)
        ) c on c.n > 0
        where t.gm_id = ${personId} and t.status in ('concluded', 'active', 'awaiting_confirmation')
      ), '[]'::json)`,
      unreadRatings: sql<number>`(
        select count(*)::int from ${notifications} n
        where n.recipient_id = ${personId} and n.type = 'rating_received' and n.read_at is null
      )`,
      latestBadge: sql<{ badgeId: string; awardedAt: string } | null>`(
        select json_build_object('badgeId', b.badge_id, 'awardedAt', b.awarded_at)
        from ${userBadges} b
        where b.profile_id = ${personId} and b.revoked_at is null
        order by b.awarded_at desc, b.badge_id limit 1
      )`,
      followers: sql<number>`(
        select count(*)::int from ${follows} f join ${profiles} p on p.id = f.follower_id
        where f.followee_id = ${personId} and p.status = 'active'
      )`,
      followees: sql<string[]>`coalesce((
        select json_agg(f.followee_id) from ${follows} f where f.follower_id = ${personId}
      ), '[]'::json)`,
      favoriteSystems: sql<string[]>`coalesce((
        select json_agg(s.slug order by s.position, s.name) from ${profileFavoriteSystems} fs
        join ${systems} s on s.id = fs.system_id
        where fs.profile_id = ${personId} and s.status = 'approved'
      ), '[]'::json)`,
    })
    .from(profiles)
    .where(eq(profiles.id, personId));
  return row;
}

/**
 * The last `HOME_FEED_DAYS` of what people the person follows did in public: tables they opened,
 * a seat that opened at one of their full tables (from the person's own notices, so it follows the
 * same switches), and badges they earned. Joining a table is never shown: that is a player's
 * business. One statement, newest first.
 */
async function followedFeed(db: AnyDb, personId: string, now: Date) {
  const since = new Date(now.getTime() - HOME_FEED_DAYS * DAY_MS);
  const opened = db
    .select({
      kind: sql<'table' | 'seat' | 'badge'>`'table'`.as('kind'),
      at: sql<string>`${gameTables.publishedAt}`.as('at'),
      username: sql<string>`${profiles.username}`.as('username'),
      slug: sql<string | null>`${gameTables.slug}`.as('slug'),
      title: sql<string | null>`${gameTables.title}`.as('title'),
      badgeId: sql<string | null>`null::text`.as('badge_id'),
    })
    .from(gameTables)
    .innerJoin(follows, eq(follows.followeeId, gameTables.gmId))
    .innerJoin(profiles, eq(profiles.id, gameTables.gmId))
    .where(
      and(
        eq(follows.followerId, personId),
        eq(gameTables.status, 'active'),
        gte(gameTables.publishedAt, since),
        eq(profiles.status, 'active'),
      ),
    );
  const seats = db
    .select({
      kind: sql<'table' | 'seat' | 'badge'>`'seat'`.as('kind'),
      at: sql<string>`${notifications.createdAt}`.as('at'),
      username: sql<string>`${profiles.username}`.as('username'),
      slug: sql<string | null>`${notifications.metadata}->>'slug'`.as('slug'),
      title: sql<string | null>`${notifications.metadata}->>'title'`.as('title'),
      badgeId: sql<string | null>`null::text`.as('badge_id'),
    })
    .from(notifications)
    .innerJoin(profiles, eq(profiles.id, notifications.actorId))
    .where(
      and(
        eq(notifications.recipientId, personId),
        eq(notifications.type, 'followed_seat_opened'),
        gte(notifications.createdAt, since),
        eq(profiles.status, 'active'),
      ),
    );
  const badges = db
    .select({
      kind: sql<'table' | 'seat' | 'badge'>`'badge'`.as('kind'),
      at: sql<string>`${userBadges.awardedAt}`.as('at'),
      username: sql<string>`${profiles.username}`.as('username'),
      slug: sql<string | null>`null::text`.as('slug'),
      title: sql<string | null>`null::text`.as('title'),
      badgeId: sql<string | null>`${userBadges.badgeId}`.as('badge_id'),
    })
    .from(userBadges)
    .innerJoin(follows, eq(follows.followeeId, userBadges.profileId))
    .innerJoin(profiles, eq(profiles.id, userBadges.profileId))
    .where(
      and(
        eq(follows.followerId, personId),
        isNull(userBadges.revokedAt),
        eq(userBadges.hidden, false),
        // A backfill's date is the run's, not when it was earned: it is no news.
        isNotNull(userBadges.sourceEventId),
        gte(userBadges.awardedAt, since),
        eq(profiles.status, 'active'),
      ),
    );
  const rows = await unionAll(opened, seats, badges)
    .orderBy(desc(sql`at`))
    .limit(HOME_FEED_COUNT);
  return rows
    .filter((row) => row.username !== null)
    .map((row) => ({ ...row, at: new Date(row.at) }));
}

/** How many people "Você já jogou com" suggests to someone who follows nobody yet. */
export const HOME_SUGGESTIONS_COUNT = 3;

/**
 * People to follow for someone who follows nobody: who ran a table they had a seat at, and who sat
 * at the same tables, most shared tables first. Active accounts with an @ only.
 */
async function suggestions(db: AnyDb, personId: string) {
  type Row = {
    id: string;
    username: string;
    avatar_path: string | null;
    avatar_url: string | null;
    ran: number;
    played: number;
  };
  const result: unknown = await db.execute(sql`
    with mine as (
      select r.table_id from ${registrations} r
      where r.player_id = ${personId} and r.status = 'confirmed'
      union
      select t.id from ${gameTables} t where t.gm_id = ${personId}
    ),
    met as (
      select t.gm_id as id, 1 as ran, 0 as played
      from mine join ${gameTables} t on t.id = mine.table_id
      union all
      select r.player_id, 0, 1
      from mine join ${registrations} r on r.table_id = mine.table_id and r.status = 'confirmed'
    )
    select p.id, p.username, p.avatar_path, p.avatar_url,
      sum(met.ran)::int as ran, sum(met.played)::int as played
    from met join ${profiles} p on p.id = met.id
    where p.id <> ${personId} and p.status = 'active' and p.username is not null
    group by p.id
    order by sum(met.ran) + sum(met.played) desc, p.username
    limit ${HOME_SUGGESTIONS_COUNT}
  `);
  // postgres.js answers with the rows, PGlite with `{ rows }`.
  const rows = (Array.isArray(result) ? result : (result as { rows: Row[] }).rows) as Row[];
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    avatarPath: row.avatar_path,
    avatarUrl: row.avatar_url,
    ran: row.ran,
    played: row.played,
  }));
}

/**
 * The signed-in Início: what waits on the person, their next sessions, "Sua conta", news from
 * people they follow, and three table rows (from people they follow, from their favorite systems,
 * Novas mesas), a table in one row only, in that order of precedence. `follows: false` (the
 * `use_follows` flag off) drops everything about following.
 *
 * Two rounds of at most five statements, never one per block: the Hyperdrive origin pool is small
 * and postgres.js opens up to five connections. Pass `publicReadNow()` so a reload within the
 * minute is a cache hit. The pictures are still storage paths. Shared by web's in-process reader
 * and, later, the api's `GET /v1/reads/home`.
 */
export async function readHome(
  db: AnyDb,
  personId: string,
  now: Date,
  { follows: withFollows }: { follows: boolean },
) {
  const [candidates, me, playing, running] = await Promise.all([
    listHomeCandidates(db, personId, now, { follows: withFollows }),
    personal(db, personId, now),
    listPlaying(db, personId, now),
    listRunning(db, personId, now),
  ]);
  if (!me) return null;

  // The rows: followed first, then favorite systems, then new; each table in its first row only.
  const followees = new Set(withFollows ? me.followees : []);
  const favorites = new Set(me.favoriteSystems);
  const rows = { followed: [], systems: [], fresh: [] } as Record<
    'followed' | 'systems' | 'fresh',
    typeof candidates.tables
  >;
  for (const table of candidates.tables) {
    if (followees.has(table.gmId)) rows.followed.push(table);
    else if (favorites.has(table.system.slug)) rows.systems.push(table);
    else if (table.publishedAt && table.publishedAt >= candidates.since) rows.fresh.push(table);
  }
  rows.fresh.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
  const shown = {
    followed: rows.followed.slice(0, HOME_ROW_COUNT),
    systems: rows.systems.slice(0, HOME_ROW_COUNT),
    fresh: rows.fresh.slice(0, HOME_ROW_COUNT),
  };

  // Someone new follows nobody and has no favorites: the follow row suggests people and the
  // systems row becomes a picker, so only they pay for those two reads.
  const lonely = withFollows && followees.size === 0;
  const [extras, myGm, myPlayer, reviews, feed, suggested, catalog] = await Promise.all([
    withExtras(db, [...shown.followed, ...shown.systems, ...shown.fresh], now),
    gmRatings(db, [personId], now),
    participantRatingOf(db, personId, now),
    publicGmReviews(db, personId, 1),
    withFollows && !lonely ? followedFeed(db, personId, now) : Promise.resolve([]),
    lonely ? suggestions(db, personId) : Promise.resolve([]),
    favorites.size === 0 ? listSystems(db) : Promise.resolve(null),
  ]);
  const byId = new Map(extras.map(({ gmId, ...table }) => [table.id, table]));
  const view = (list: typeof candidates.tables) => list.map((table) => byId.get(table.id)!);

  const waiting: WaitingItem[] = [
    ...me.invitations.map((invitation) => ({
      kind: 'invitation' as const,
      ...invitation,
      expiresAt: new Date(invitation.expiresAt),
    })),
    ...running
      .filter((table) => table.tableStatus === 'awaiting_confirmation')
      .map(({ slug, title }) => ({ kind: 'confirm' as const, slug, title })),
    ...running
      .filter((table) => table.requests.length > 0 && table.tableStatus === 'active')
      .map(({ slug, title, requests }) => ({
        kind: 'requests' as const,
        slug,
        title,
        count: requests.length,
      })),
    ...playing
      .filter((table) => table.canRate && table.rating === null)
      .map(({ slug, title }) => ({ kind: 'rate_gm' as const, slug, title })),
    ...me.toRate
      .filter((table) =>
        playerRatingOpen({
          tableStatus: table.status,
          kind: table.kind as 'campaign' | 'one_shot' | 'adventure',
        }),
      )
      .map(({ slug, title, count }) => ({ kind: 'rate_players' as const, slug, title, count })),
  ].sort((a, b) => URGENCY[a.kind] - URGENCY[b.kind]);

  // The next sessions, as a player with a seat or as the GM, soonest first.
  const sessions = [
    ...playing
      .filter((table) => table.status === 'confirmed')
      .map((table) => ({ ...table, running: false })),
    ...running.map((table) => ({ ...table, running: true })),
  ]
    .filter((table) => table.tableStatus === 'active' && !hasStarted(table.startsAt, now))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const weekEnd = now.getTime() + 7 * DAY_MS;

  return {
    waiting: { items: waiting.slice(0, HOME_WAITING_COUNT), total: waiting.length },
    sessions: {
      next: sessions.slice(0, HOME_SESSIONS_COUNT).map((table) => ({
        slug: table.slug,
        title: table.title,
        startsAt: table.startsAt,
        timezone: table.timezone,
        running: table.running,
      })),
      thisWeek: sessions.filter((table) => table.startsAt.getTime() < weekEnd).length,
    },
    account: {
      gm: myGm.get(personId)!,
      player: myPlayer,
      unreadRatings: me.unreadRatings,
      newestReview: reviews.at(0) ?? null,
      latestBadge: me.latestBadge
        ? { badgeId: me.latestBadge.badgeId, awardedAt: new Date(me.latestBadge.awardedAt) }
        : null,
      followers: withFollows ? me.followers : null,
    },
    feed,
    rows: {
      followed: withFollows ? view(shown.followed) : null,
      systems: view(shown.systems),
      fresh: view(shown.fresh),
    },
    favoriteSystems: me.favoriteSystems,
    showFavoriteSystems: me.showFavoriteSystems,
    suggestions: suggested,
    // The approved systems, only while there are no favorites (for the picker in their place).
    systemsCatalog: catalog,
    following: withFollows ? followees.size : null,
    newTableDays: NEW_TABLE_DAYS,
  };
}

export type Home = NonNullable<Awaited<ReturnType<typeof readHome>>>;
