import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { matchCards, matches, notifications, profileBlocks, profiles } from '../db/schema';
import { routes } from '../../routes';
import { NOTIFICATION_KINDS } from '../../notifications/kinds';
import { MATCH_REMINDER_DAYS, MATCH_REMINDERS } from '../../matches/schema';

// Combinar's graph: people are the nodes; two kinds of edge join them. "Jogaram juntos": both had a
// confirmed seat at a table that was played (or one ran it), old tables included. "Combinaram": a
// match both still keep. Only these two are ever shown to the two people concerned; everything
// else (who is two steps away, the community's groups) is counted, never named.

/** A uuid[] parameter, as the raw SQL below takes it. */
const uuids = (ids: readonly string[]) => sql`${`{${ids.join(',')}}`}::uuid[]`;

/** Two people who played together: how many tables, and the latest session they shared. */
export type PlayedPair = { a: string; b: string; tables: number; lastAt: Date };

/**
 * Who played with whom: pairs (a, b) with `a` among `left` and `b` among `right` (anyone when
 * null). A table counts once a session of it (or its date) is past and it was not called off: the
 * GM and every confirmed player who was not marked absent. Old tables count from the start.
 */
export async function playedPairs(
  db: AnyDb,
  left: readonly string[],
  right: readonly string[] | null,
  now = new Date(),
): Promise<PlayedPair[]> {
  if (left.length === 0 || right?.length === 0) return [];
  const at = now.toISOString();
  const result: unknown = await db.execute(sql`
    with played as (
      select t.id as table_id, greatest(
        (select max(s.starts_at) from table_sessions s
          where s.table_id = t.id and s.starts_at <= ${at}::timestamptz and s.status in ('scheduled', 'held')),
        case when t.starts_at <= ${at}::timestamptz then t.starts_at end
      ) as last_at
      from game_tables t
      where t.status not in ('draft', 'disabled', 'not_held')
        and (t.gm_id = any(${uuids(left)}) or exists (
          select 1 from registrations r where r.table_id = t.id and r.player_id = any(${uuids(left)})
            and r.status = 'confirmed' and r.attended is not false))
    ),
    participants as (
      select p.table_id, t.gm_id as profile_id, p.last_at
        from played p join game_tables t on t.id = p.table_id where p.last_at is not null
      union
      select p.table_id, r.player_id, p.last_at
        from played p join registrations r on r.table_id = p.table_id
        where p.last_at is not null and r.status = 'confirmed' and r.attended is not false
    )
    select x.profile_id as a, y.profile_id as b, count(distinct x.table_id)::int as tables,
      max(x.last_at) as last_at
    from participants x join participants y on y.table_id = x.table_id and y.profile_id <> x.profile_id
    where x.profile_id = any(${uuids(left)})
      ${right ? sql`and y.profile_id = any(${uuids(right)})` : sql``}
    group by x.profile_id, y.profile_id
  `);
  // postgres.js answers with the rows, PGlite with `{ rows }`.
  type Row = { a: string; b: string; tables: number; last_at: string | Date };
  const rows = (Array.isArray(result) ? result : (result as { rows: Row[] }).rows) as Row[];
  return rows.map((row) => ({
    a: row.a,
    b: row.b,
    tables: Number(row.tables),
    lastAt: new Date(row.last_at),
  }));
}

/** Matches both still keep, between `left` and `right` (anyone when null), each way round. */
export async function matchedPairs(
  db: AnyDb,
  left: readonly string[],
  right: readonly string[] | null,
): Promise<{ a: string; b: string; createdAt: Date }[]> {
  if (left.length === 0 || right?.length === 0) return [];
  const rows = await db
    .select({ a: matches.profileA, b: matches.profileB, createdAt: matches.createdAt })
    .from(matches)
    .where(
      and(
        isNull(matches.endedAt),
        or(inArray(matches.profileA, [...left]), inArray(matches.profileB, [...left])),
      ),
    );
  const inLeft = new Set(left);
  const inRight = right ? new Set(right) : null;
  return rows
    .flatMap((row) => [row, { a: row.b, b: row.a, createdAt: row.createdAt }])
    .filter((row) => inLeft.has(row.a) && (!inRight || inRight.has(row.b)));
}

/** The people one step from the person: matched or played with. */
export async function neighboursOf(db: AnyDb, profileId: string, now = new Date()) {
  const [played, matched] = await Promise.all([
    playedPairs(db, [profileId], null, now),
    matchedPairs(db, [profileId], null),
  ]);
  return { played, ids: new Set([...played, ...matched].map((pair) => pair.b)) };
}

/**
 * For each candidate, how many of the person's own people (matched or played with) they are joined
 * to too: "vocês têm gente em comum", never who.
 */
export async function peopleInCommon(
  db: AnyDb,
  mine: ReadonlySet<string>,
  candidates: readonly string[],
  now = new Date(),
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (mine.size === 0 || candidates.length === 0) return out;
  const [played, matched] = await Promise.all([
    playedPairs(db, candidates, [...mine], now),
    matchedPairs(db, candidates, [...mine]),
  ]);
  const seen = new Map<string, Set<string>>();
  for (const pair of [...played, ...matched]) {
    const set = seen.get(pair.a) ?? new Set<string>();
    set.add(pair.b);
    seen.set(pair.a, set);
  }
  for (const [id, set] of seen) out.set(id, set.size);
  return out;
}

export type PlayedPerson = {
  username: string;
  name: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
  tableRole: 'player' | 'gm' | 'both' | null;
  tables: number;
  lastAt: Date;
};

/**
 * "Quem já jogou comigo": everyone the person shared a played table with, latest first, `pageSize`
 * a page; null past the last page. Only active adults with a @usuário, and nobody either of the two
 * blocked.
 */
export async function listPlayedWith(
  db: AnyDb,
  profileId: string,
  page: number,
  { now = new Date(), pageSize = 20 }: { now?: Date; pageSize?: number } = {},
): Promise<{ total: number; pages: number; items: PlayedPerson[] } | null> {
  const pairs = await playedPairs(db, [profileId], null, now);
  const ids = pairs.map((pair) => pair.b);
  const people = ids.length
    ? await db
        .select({
          id: profiles.id,
          username: profiles.username,
          name: profiles.name,
          showName: profiles.showName,
          avatarPath: profiles.avatarPath,
          avatarUrl: profiles.avatarUrl,
          tableRole: profiles.tableRole,
        })
        .from(profiles)
        .where(
          and(
            inArray(profiles.id, ids),
            eq(profiles.status, 'active'),
            sql`${profiles.username} is not null`,
            sql`${profiles.ageRange} is distinct from '13_17'`,
            sql`not exists (select 1 from ${profileBlocks} where (${profileBlocks.blockerId} = ${profileId} and ${profileBlocks.blockedId} = ${profiles.id}) or (${profileBlocks.blockerId} = ${profiles.id} and ${profileBlocks.blockedId} = ${profileId}))`,
          ),
        )
    : [];
  const byId = new Map(people.map((person) => [person.id, person]));
  const all = pairs
    .filter((pair) => byId.has(pair.b))
    .sort(
      (x, y) =>
        y.lastAt.getTime() - x.lastAt.getTime() ||
        byId.get(x.b)!.username!.localeCompare(byId.get(y.b)!.username!),
    );
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (page > pages) return null;
  return {
    total,
    pages,
    items: all.slice((page - 1) * pageSize, page * pageSize).map((pair) => {
      const person = byId.get(pair.b)!;
      return {
        username: person.username!,
        name: (person.showName && person.name) || null,
        avatarPath: person.avatarPath,
        avatarUrl: person.avatarUrl,
        tableRole: person.tableRole,
        tables: pair.tables,
        lastAt: pair.lastAt,
      };
    }),
  };
}

/**
 * The sweep's reminder: two people who matched and have not played together since get "vocês
 * combinaram e ainda não jogaram" in the bell, MATCH_REMINDER_DAYS after the match and again after
 * as long once more (MATCH_REMINDERS in all). Playing together, an undone match, a block or a
 * suspended account stops it. Bell only. Returns how many matches were reminded.
 */
export async function remindUnplayedMatches(db: AnyDb, now = new Date(), limit = 200) {
  const due = await db
    .select({
      id: matches.id,
      a: matches.profileA,
      b: matches.profileB,
      createdAt: matches.createdAt,
      reminders: matches.reminders,
    })
    .from(matches)
    .where(
      and(
        isNull(matches.endedAt),
        lt(matches.reminders, MATCH_REMINDERS),
        sql`${matches.createdAt} <= ${now.toISOString()}::timestamptz - make_interval(days => ${MATCH_REMINDER_DAYS} * (${matches.reminders} + 1))`,
      ),
    )
    .limit(limit);
  let reminded = 0;
  for (const match of due) {
    const [played] = await playedPairs(db, [match.a], [match.b], now);
    if (played && played.lastAt >= match.createdAt) {
      await db.update(matches).set({ reminders: MATCH_REMINDERS }).where(eq(matches.id, match.id));
      continue;
    }
    const people = await db
      .select({ id: profiles.id, status: profiles.status, username: profiles.username })
      .from(profiles)
      .where(inArray(profiles.id, [match.a, match.b]));
    const [blocked] = await db
      .select({ id: profileBlocks.blockerId })
      .from(profileBlocks)
      .where(
        or(
          and(eq(profileBlocks.blockerId, match.a), eq(profileBlocks.blockedId, match.b)),
          and(eq(profileBlocks.blockerId, match.b), eq(profileBlocks.blockedId, match.a)),
        ),
      );
    const round = match.reminders + 1;
    await db
      .update(matches)
      .set({ reminders: round, remindedAt: now })
      .where(eq(matches.id, match.id));
    if (blocked || people.length !== 2 || people.some((p) => p.status !== 'active' || !p.username))
      continue;
    const [x, y] = people;
    await db.insert(notifications).values(
      [
        [x, y],
        [y, x],
      ].map(([recipient, other]) => ({
        recipientId: recipient.id,
        actorId: other.id,
        category: NOTIFICATION_KINDS.match_reminder.category,
        type: 'match_reminder',
        link: routes.matchList,
        metadata: { matchId: match.id, round },
        createdAt: now,
      })),
    );
    reminded += 1;
  }
  return reminded;
}

export type MatchGraphStats = {
  /** Cards switched on. */
  people: number;
  /** Matches both keep. */
  matches: number;
  /** Of those, the ones whose two played together after matching. */
  playedAfter: number;
  /** People with a card on and no edge at all to another card. */
  alone: number;
  /** Groups of two or more joined by any edge, and the largest one's size. */
  groups: number;
  largest: number;
};

/** The community map on the admin overview: counts only, no names. */
export async function matchGraphStats(db: AnyDb, now = new Date()): Promise<MatchGraphStats> {
  const cards = await db
    .select({ id: matchCards.profileId })
    .from(matchCards)
    .innerJoin(profiles, eq(profiles.id, matchCards.profileId))
    .where(and(sql`${matchCards.enabledAt} is not null`, eq(profiles.status, 'active')));
  const ids = cards.map((card) => card.id);
  const [played, matched] = await Promise.all([
    playedPairs(db, ids, ids, now),
    matchedPairs(db, ids, ids),
  ]);
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  for (const pair of [...played, ...matched]) parent.set(find(pair.a), find(pair.b));
  const sizes = new Map<string, number>();
  for (const id of ids) sizes.set(find(id), (sizes.get(find(id)) ?? 0) + 1);
  const groups = [...sizes.values()].filter((size) => size > 1);

  const allMatches = await db
    .select({ a: matches.profileA, b: matches.profileB, createdAt: matches.createdAt })
    .from(matches)
    .where(isNull(matches.endedAt));
  const playedLast = new Map<string, Date>();
  if (allMatches.length > 0) {
    const pairs = await playedPairs(
      db,
      [...new Set(allMatches.map((match) => match.a))],
      [...new Set(allMatches.map((match) => match.b))],
      now,
    );
    for (const pair of pairs) playedLast.set(`${pair.a}:${pair.b}`, pair.lastAt);
  }
  const playedAfter = allMatches.filter(
    (match) =>
      (playedLast.get(`${match.a}:${match.b}`)?.getTime() ?? 0) >= match.createdAt.getTime(),
  ).length;
  return {
    people: ids.length,
    matches: allMatches.length,
    playedAfter,
    alone: [...sizes.values()].filter((size) => size === 1).length,
    groups: groups.length,
    largest: groups.length ? Math.max(...groups) : 0,
  };
}
