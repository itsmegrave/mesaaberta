import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import {
  matchAnswers,
  matchCards,
  matches,
  profileBlocks,
  profileFavoriteSystems,
  profiles,
  systems,
} from '../db/schema';
import { Forbidden, Invalid, NotFound, RateLimited } from '../errors';
import { recordEvent } from '../events/outbox';
import { pictureOf } from '../images';
import { gmRatings } from '../ratings/service';
import { participantRatings } from '../ratings/players';
import { neighboursOf, peopleInCommon } from './graph';
import {
  fitOf,
  isAdultRange,
  MATCH_ANSWER_DAYS,
  MATCH_CARD_SYSTEMS,
  MATCH_DAILY_ANSWERS,
  MATCH_DECK_SIZE,
  MATCH_PASS_DAYS,
  MATCH_PLAYED_DAYS,
  MATCH_WEIGHTS,
  MATCHES_PAGE_SIZE,
  SEEKING_MEETS,
  type MatchAnswerInput,
  type MatchAxes,
  type MatchCardInput,
  type MatchFit,
  type MatchSeeking,
} from '../../matches/schema';

const DAY_MS = 86_400_000;
/** "Quando posso jogar" has 21 slots (`profile/availability`). */
const SLOT_BITS = 21;

type Card = typeof matchCards.$inferSelect;

/** What the setup needs: the card (null: never set up) and the profile facts it builds on. */
export type MatchCardState = {
  card: {
    enabled: boolean;
    seeking: MatchSeeking[];
    online: boolean;
    inPerson: boolean;
    axes: MatchAxes;
  } | null;
  /** An adult age range on the profile: without it Combinar explains instead of opening. */
  adult: boolean;
  /** Under 18 by the profile: Combinar is closed to them, not just waiting for an answer. */
  minor: boolean;
  tableRole: 'player' | 'gm' | 'both' | null;
  city: string | null;
  favoriteSystems: number;
  availabilitySlots: number;
};

const axesOf = (card: Card): MatchAxes => ({
  combat: card.axisCombat,
  rules: card.axisRules,
  length: card.axisLength,
  tone: card.axisTone,
});

const slotsIn = (mask: number) => mask.toString(2).replaceAll('0', '').length;

/** The person's own card and the profile facts the setup shows. */
export async function matchCardOf(db: AnyDb, profileId: string): Promise<MatchCardState> {
  const [[row], [favorites]] = await Promise.all([
    db
      .select({
        ageRange: profiles.ageRange,
        tableRole: profiles.tableRole,
        city: profiles.city,
        availability: profiles.availability,
        card: matchCards,
      })
      .from(profiles)
      .leftJoin(matchCards, eq(matchCards.profileId, profiles.id))
      .where(eq(profiles.id, profileId)),
    db
      .select({ n: count() })
      .from(profileFavoriteSystems)
      .where(eq(profileFavoriteSystems.profileId, profileId)),
  ]);
  if (!row) throw new NotFound();
  const card = row.card;
  return {
    card: card
      ? {
          enabled: card.enabledAt !== null,
          seeking: card.seeking,
          online: card.online,
          inPerson: card.inPerson,
          axes: axesOf(card),
        }
      : null,
    adult: isAdultRange(row.ageRange),
    minor: row.ageRange === '13_17',
    tableRole: row.tableRole,
    city: row.city?.trim() || null,
    favoriteSystems: favorites?.n ?? 0,
    availabilitySlots: slotsIn(row.availability),
  };
}

/**
 * Saves the card and switches it on, or switches it off. On needs an adult age range on the profile
 * and the "Tenho 18 anos ou mais" confirmation; presencial needs a city on the profile. Off takes the
 * person out of every deck and deletes the answers they gave (the matches stay).
 */
export async function saveMatchCard(
  db: AnyDb,
  profileId: string,
  input: MatchCardInput,
  now = new Date(),
): Promise<{ eventIds: string[] }> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [profile] = await t
      .select({ ageRange: profiles.ageRange, city: profiles.city })
      .from(profiles)
      .where(eq(profiles.id, profileId));
    if (!profile) throw new NotFound();
    const [existing] = await t.select().from(matchCards).where(eq(matchCards.profileId, profileId));

    if (!input.enabled) {
      if (!existing) return { eventIds: [] };
      await t
        .update(matchCards)
        .set({ enabledAt: null })
        .where(eq(matchCards.profileId, profileId));
      await t.delete(matchAnswers).where(eq(matchAnswers.fromId, profileId));
      if (existing.enabledAt === null) return { eventIds: [] };
      const eventId = await recordEvent(t, {
        type: 'MatchCardChanged',
        actorId: profileId,
        payload: { profileId, enabled: false },
      });
      return { eventIds: [eventId] };
    }

    if (!isAdultRange(profile.ageRange)) throw new Invalid('adult', 'adult_only');
    if (input.inPerson && !profile.city?.trim()) throw new Invalid('inPerson', 'city_required');
    const values = {
      seeking: [...new Set(input.seeking)],
      online: input.online,
      inPerson: input.inPerson,
      axisCombat: input.combat,
      axisRules: input.rules,
      axisLength: input.length,
      axisTone: input.tone,
    };
    await t
      .insert(matchCards)
      .values({ profileId, enabledAt: now, adultConfirmedAt: now, ...values })
      .onConflictDoUpdate({
        target: matchCards.profileId,
        set: {
          ...values,
          enabledAt: existing?.enabledAt ?? now,
          adultConfirmedAt: existing?.adultConfirmedAt ?? now,
        },
      });
    const eventId = await recordEvent(t, {
      type: 'MatchCardChanged',
      actorId: profileId,
      payload: { profileId, enabled: true },
    });
    return { eventIds: [eventId] };
  });
}

/** Whether either of the two blocked the other. */
const blockedWith = (meId: string) =>
  sql`exists (select 1 from ${profileBlocks} where (${profileBlocks.blockerId} = ${meId} and ${profileBlocks.blockedId} = ${profiles.id}) or (${profileBlocks.blockerId} = ${profiles.id} and ${profileBlocks.blockedId} = ${meId}))`;

/** A match between the two, now or undone: either way they never meet in the deck again. */
const matchedWith = (meId: string) =>
  sql`exists (select 1 from ${matches} where (${matches.profileA} = ${meId} and ${matches.profileB} = ${profiles.id}) or (${matches.profileB} = ${meId} and ${matches.profileA} = ${profiles.id}))`;

type Me = { id: string; card: Card; city: string | null };

/**
 * The cards that may meet this person's: switched on, active, adult, not them, wanting what meets
 * what they want, sharing a format (presencial needs the same city), with no block between the two
 * and no match ever made.
 */
function fits(me: Me) {
  const meets = [...new Set(me.card.seeking.map((wish) => SEEKING_MEETS[wish]))];
  const city = me.city?.trim().toLowerCase() || null;
  return and(
    isNotNull(matchCards.enabledAt),
    eq(profiles.status, 'active'),
    isNotNull(profiles.username),
    isNotNull(profiles.ageRange),
    ne(profiles.ageRange, '13_17'),
    ne(profiles.id, me.id),
    sql`${matchCards.seeking} && ${`{${meets.join(',')}}`}::match_seeking[]`,
    or(
      me.card.online ? eq(matchCards.online, true) : sql`false`,
      me.card.inPerson && city
        ? and(eq(matchCards.inPerson, true), sql`lower(trim(${profiles.city})) = ${city}`)
        : sql`false`,
    ),
    sql`not ${blockedWith(me.id)}`,
    sql`not ${matchedWith(me.id)}`,
  );
}

/** The person's card when it is on and they are an adult; else why the deck cannot open. */
async function meFor(db: AnyDb, profileId: string) {
  const [row] = await db
    .select({ ageRange: profiles.ageRange, city: profiles.city, card: matchCards })
    .from(profiles)
    .leftJoin(matchCards, eq(matchCards.profileId, profiles.id))
    .where(eq(profiles.id, profileId));
  if (!row) throw new NotFound();
  if (!isAdultRange(row.ageRange)) return { state: 'not_adult' as const };
  if (!row.card) return { state: 'no_card' as const };
  if (row.card.enabledAt === null) return { state: 'off' as const };
  return { state: 'ready' as const, me: { id: profileId, card: row.card, city: row.city } };
}

export type MatchRating = { score: number; count: number };

/** One person as a card in the deck or a row of the matches list. */
export type MatchPerson = {
  username: string;
  name: string | null;
  avatarUrl: string | null;
  tableRole: 'player' | 'gm' | 'both' | null;
  /** Only when they play presencial. */
  city: string | null;
  online: boolean;
  inPerson: boolean;
  axes: MatchAxes;
  score: number;
  fit: MatchFit;
  /** Their favorite systems you have too, then the others (both only when they show them). */
  commonSystems: { name: string; slug: string }[];
  otherSystems: { name: string; slug: string }[];
  moreSystems: number;
  /** "Quando posso jogar" slots in common. */
  commonSlots: number;
  bothOnline: boolean;
  sameCity: boolean;
  /** The public scores, when there are any ("na mestragem" only for people who run games). */
  gm: MatchRating | null;
  player: MatchRating | null;
  /** How many of the viewer's own people (matched or played with) they are joined to too. */
  commonPeople: number;
};

export type MatchDeck =
  | { state: 'not_adult' | 'no_card' | 'off' }
  | { state: 'ready'; people: MatchPerson[]; answersLeft: number; canUndo: boolean };

/** How many answers the person gave in the last day. */
async function answersToday(db: AnyDb, profileId: string, now: Date) {
  const [row] = await db
    .select({ n: count() })
    .from(matchAnswers)
    .where(
      and(
        eq(matchAnswers.fromId, profileId),
        gt(matchAnswers.createdAt, new Date(now.getTime() - DAY_MS)),
      ),
    );
  return row?.n ?? 0;
}

/**
 * The next cards of the person's deck, best fit first: up to MATCH_DECK_SIZE people whose cards fit
 * theirs and whom they have not answered in MATCH_PASS_DAYS (yes or no), nor who passed on them in
 * that time. The score is systems in common, free times in common and how close the four axes are.
 */
export async function matchDeck(
  db: AnyDb,
  profileId: string,
  {
    now = new Date(),
    supabaseUrl,
    graph = false,
  }: { now?: Date; supabaseUrl?: string; graph?: boolean } = {},
): Promise<MatchDeck> {
  const found = await meFor(db, profileId);
  if (found.state !== 'ready') return { state: found.state };
  const { me } = found;
  const passSince = new Date(now.getTime() - MATCH_PASS_DAYS * DAY_MS).toISOString();

  const [answered, myAvailability] = await Promise.all([
    answersToday(db, profileId, now),
    db
      .select({ availability: profiles.availability })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .then(([row]) => row?.availability ?? 0),
  ]);
  const answersLeft = Math.max(0, MATCH_DAILY_ANSWERS - answered);
  const canUndo = answered > 0;
  if (answersLeft === 0) return { state: 'ready', people: [], answersLeft, canUndo };
  const size = Math.min(MATCH_DECK_SIZE, answersLeft);

  // The graph (`use_play_graph`): whoever played with the person lately stays out, and people
  // joined to the person's own come first.
  const near = graph ? await neighboursOf(db, profileId, now) : null;
  const playedSince = now.getTime() - MATCH_PLAYED_DAYS * DAY_MS;
  const recent = (near?.played ?? [])
    .filter((pair) => pair.lastAt.getTime() > playedSince)
    .map((pair) => pair.b);

  const mine = sql`(select count(*) from ${profileFavoriteSystems} where ${profileFavoriteSystems.profileId} = ${me.id})`;
  const theirs = sql`(select count(*) from profile_favorite_systems f where f.profile_id = ${profiles.id})`;
  const shared = sql`(select count(*) from profile_favorite_systems a inner join profile_favorite_systems b on b.system_id = a.system_id where a.profile_id = ${me.id} and b.profile_id = ${profiles.id})`;
  const systemsScore = sql`case when ${profiles.showFavoriteSystems} then ${sql.raw(String(MATCH_WEIGHTS.systems))}.0 * ${shared} / greatest(1, least(${mine}, ${theirs})) else 0 end`;
  const slots = (mask: unknown) =>
    sql`length(replace((${mask})::bit(${sql.raw(String(SLOT_BITS))})::text, '0', ''))`;
  const commonSlots = slots(sql`(${profiles.availability} & ${myAvailability})`);
  const availabilityScore = sql`${sql.raw(String(MATCH_WEIGHTS.availability))}.0 * ${commonSlots} / greatest(1, least(${slots(sql`${profiles.availability}`)}, ${slotsIn(myAvailability)}))`;
  const c = me.card;
  const styleScore = sql`${sql.raw(String(MATCH_WEIGHTS.style))}.0 * (1 - (abs(${matchCards.axisCombat} - ${c.axisCombat}) + abs(${matchCards.axisRules} - ${c.axisRules}) + abs(${matchCards.axisLength} - ${c.axisLength}) + abs(${matchCards.axisTone} - ${c.axisTone})) / 400.0)`;
  const score = sql<number>`round(${systemsScore} + ${availabilityScore} + ${styleScore})::int`;

  const rows = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      name: profiles.name,
      showName: profiles.showName,
      avatarPath: profiles.avatarPath,
      avatarUrl: profiles.avatarUrl,
      tableRole: profiles.tableRole,
      city: profiles.city,
      showFavoriteSystems: profiles.showFavoriteSystems,
      card: matchCards,
      commonSlots: sql<number>`${commonSlots}::int`,
      score,
    })
    .from(matchCards)
    .innerJoin(profiles, eq(profiles.id, matchCards.profileId))
    .where(
      and(
        fits(me),
        // Not answered by them in the last MATCH_PASS_DAYS: then the card comes back as a reminder.
        sql`not exists (select 1 from ${matchAnswers} where ${matchAnswers.fromId} = ${me.id} and ${matchAnswers.toId} = ${profiles.id} and ${matchAnswers.createdAt} > ${passSince}::timestamptz)`,
        // Nor passed on them in that time: nobody is told, the card just never comes.
        sql`not exists (select 1 from ${matchAnswers} where ${matchAnswers.fromId} = ${profiles.id} and ${matchAnswers.toId} = ${me.id} and not ${matchAnswers.yes} and ${matchAnswers.createdAt} > ${passSince}::timestamptz)`,
        recent.length
          ? sql`not (${profiles.id} = any(${`{${recent.join(',')}}`}::uuid[]))`
          : undefined,
      ),
    )
    .orderBy(desc(score), desc(matchCards.updatedAt), asc(profiles.username))
    // With the graph, a wider pick, so people in common can move up before the cut.
    .limit(near ? MATCH_DECK_SIZE * 3 : size);

  const common = near
    ? await peopleInCommon(
        db,
        near.ids,
        rows.map((row) => row.id),
        now,
      )
    : new Map<string, number>();
  const boosted = near
    ? rows
        .map((row, i) => ({ row, i, rank: row.score + ((common.get(row.id) ?? 0) > 0 ? 10 : 0) }))
        .sort((x, y) => y.rank - x.rank || x.i - y.i)
        .slice(0, size)
        .map(({ row }) => row)
    : rows;
  const people = await present(db, me, boosted, { now, supabaseUrl });
  return {
    state: 'ready',
    people: people.map((person, i) => ({
      ...person,
      commonPeople: common.get(boosted[i].id) ?? 0,
    })),
    answersLeft,
    canUndo,
  };
}

type Row = {
  id: string;
  username: string | null;
  name: string | null;
  showName: boolean;
  avatarPath: string | null;
  avatarUrl: string | null;
  tableRole: 'player' | 'gm' | 'both' | null;
  city: string | null;
  showFavoriteSystems: boolean;
  card: Card | null;
  commonSlots: number;
  score: number;
};

/** The rows as cards: their systems split into "em comum" and the rest, and their scores. */
async function present(
  db: AnyDb,
  me: Me,
  rows: Row[],
  { now, supabaseUrl }: { now: Date; supabaseUrl?: string },
): Promise<MatchPerson[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const shown = rows.filter((row) => row.showFavoriteSystems).map((row) => row.id);
  const [favorites, mine, gms, players] = await Promise.all([
    shown.length
      ? db
          .select({
            profileId: profileFavoriteSystems.profileId,
            id: systems.id,
            name: systems.name,
            slug: systems.slug,
          })
          .from(profileFavoriteSystems)
          .innerJoin(systems, eq(systems.id, profileFavoriteSystems.systemId))
          .where(
            and(inArray(profileFavoriteSystems.profileId, shown), eq(systems.status, 'approved')),
          )
          .orderBy(asc(systems.name))
      : [],
    db
      .select({ id: profileFavoriteSystems.systemId })
      .from(profileFavoriteSystems)
      .where(eq(profileFavoriteSystems.profileId, me.id)),
    gmRatings(
      db,
      rows.filter((row) => row.tableRole === 'gm' || row.tableRole === 'both').map((row) => row.id),
      now,
    ),
    participantRatings(db, ids, now),
  ]);
  const myIds = new Set(mine.map((row) => row.id));
  const rated = (rating: { score: number | null; count: number } | undefined) =>
    rating && rating.score !== null && rating.count > 0
      ? { score: Math.round(rating.score * 10) / 10, count: rating.count }
      : null;
  const myCity = me.city?.trim().toLowerCase() || null;

  return rows.map((row) => {
    const card = row.card!;
    const theirs = favorites.filter((f) => f.profileId === row.id);
    const common = theirs.filter((f) => myIds.has(f.id)).map(({ name, slug }) => ({ name, slug }));
    const others = theirs.filter((f) => !myIds.has(f.id)).map(({ name, slug }) => ({ name, slug }));
    const room = Math.max(0, MATCH_CARD_SYSTEMS - common.length);
    const city = card.inPerson ? row.city?.trim() || null : null;
    return {
      username: row.username!,
      name: (row.showName && row.name) || null,
      avatarUrl: pictureOf(supabaseUrl, row),
      tableRole: row.tableRole,
      city,
      online: card.online,
      inPerson: card.inPerson,
      axes: axesOf(card),
      score: Math.max(0, Math.min(100, row.score)),
      fit: fitOf(row.score),
      commonSystems: common,
      otherSystems: others.slice(0, room),
      moreSystems: Math.max(0, others.length - room),
      commonSlots: row.commonSlots,
      bothOnline: me.card.online && card.online,
      sameCity: me.card.inPerson && card.inPerson && !!city && city.toLowerCase() === myCity,
      gm: rated(gms.get(row.id)),
      player: rated(players.get(row.id)),
      commonPeople: 0,
    };
  });
}

/** Nobody's id: seen from it, every favorite system is "theirs", none "em comum". */
const NOBODY = '00000000-0000-4000-8000-000000000000';

/**
 * The person's own card as others see it, for the preview on Meu cartão: their name, photo,
 * systems and ratings, with nothing "em comum". The setup draws its own answers over it as they
 * change. Null without a @usuário.
 */
export async function matchPreviewOf(
  db: AnyDb,
  profileId: string,
  { now = new Date(), supabaseUrl }: { now?: Date; supabaseUrl?: string } = {},
): Promise<MatchPerson | null> {
  const [row] = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      name: profiles.name,
      showName: profiles.showName,
      avatarPath: profiles.avatarPath,
      avatarUrl: profiles.avatarUrl,
      tableRole: profiles.tableRole,
      city: profiles.city,
      showFavoriteSystems: profiles.showFavoriteSystems,
      card: matchCards,
    })
    .from(profiles)
    .leftJoin(matchCards, eq(matchCards.profileId, profiles.id))
    .where(eq(profiles.id, profileId));
  if (!row?.username) return null;
  const card: Card = row.card ?? {
    profileId,
    enabledAt: null,
    adultConfirmedAt: now,
    seeking: [],
    online: true,
    inPerson: false,
    axisCombat: 50,
    axisRules: 50,
    axisLength: 50,
    axisTone: 50,
    createdAt: now,
    updatedAt: now,
  };
  const [person] = await present(
    db,
    { id: NOBODY, card: { ...card, online: false, inPerson: false }, city: null },
    [{ ...row, card, commonSlots: 0, score: 0 }],
    { now, supabaseUrl },
  );
  return { ...person, fit: null };
}

export type MatchAnswerResult = {
  eventIds: string[];
  /** Set when this yes made a match: who with, for "Bora jogar!". */
  match: { id: string; person: MatchPerson } | null;
};

const ordered = (a: string, b: string) => (a < b ? [a, b] : [b, a]) as [string, string];

/**
 * A yes or a no about someone in the deck, by their @usuário. MATCH_DAILY_ANSWERS a day. A yes that
 * meets their yes makes the match (`MatchCreated`, both hear in the bell); a second answer about
 * the same person replaces the first.
 */
export async function answerMatch(
  db: AnyDb,
  profileId: string,
  input: MatchAnswerInput,
  { now = new Date(), supabaseUrl }: { now?: Date; supabaseUrl?: string } = {},
): Promise<MatchAnswerResult> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const found = await meFor(t, profileId);
    if (found.state !== 'ready') throw new Forbidden('match:answer');
    const { me } = found;

    // Serialise one person's answers, so two at once cannot both slip under the daily cap.
    await t.execute(sql`select pg_advisory_xact_lock(hashtext(${'match-answer:' + profileId}))`);
    const given = await answersToday(t, profileId, now);
    if (given >= MATCH_DAILY_ANSWERS) {
      const [oldest] = await t
        .select({ at: matchAnswers.createdAt })
        .from(matchAnswers)
        .where(
          and(
            eq(matchAnswers.fromId, profileId),
            gt(matchAnswers.createdAt, new Date(now.getTime() - DAY_MS)),
          ),
        )
        .orderBy(asc(matchAnswers.createdAt))
        .limit(1);
      const frees = (oldest?.at.getTime() ?? now.getTime()) + DAY_MS;
      throw new RateLimited(Math.max(1, Math.ceil((frees - now.getTime()) / 1000)));
    }

    const rows = await t
      .select({
        id: profiles.id,
        username: profiles.username,
        name: profiles.name,
        showName: profiles.showName,
        avatarPath: profiles.avatarPath,
        avatarUrl: profiles.avatarUrl,
        tableRole: profiles.tableRole,
        city: profiles.city,
        showFavoriteSystems: profiles.showFavoriteSystems,
        card: matchCards,
        commonSlots: sql<number>`0`,
        score: sql<number>`0`,
      })
      .from(matchCards)
      .innerJoin(profiles, eq(profiles.id, matchCards.profileId))
      .where(and(fits(me), eq(profiles.username, input.username)));
    const target = rows[0];
    if (!target) throw new NotFound();

    await t
      .insert(matchAnswers)
      .values({ fromId: profileId, toId: target.id, yes: input.yes, createdAt: now })
      .onConflictDoUpdate({
        target: [matchAnswers.fromId, matchAnswers.toId],
        set: { yes: input.yes, createdAt: now },
      });
    if (!input.yes) return { eventIds: [], match: null };

    const [a, b] = ordered(profileId, target.id);
    // Both yeses landing at once: the pair's lock lets one of them make the match.
    await t.execute(sql`select pg_advisory_xact_lock(hashtext(${'match:' + a + ':' + b}))`);
    const [theirYes] = await t
      .select({ yes: matchAnswers.yes })
      .from(matchAnswers)
      .where(
        and(
          eq(matchAnswers.fromId, target.id),
          eq(matchAnswers.toId, profileId),
          eq(matchAnswers.yes, true),
        ),
      );
    if (!theirYes) return { eventIds: [], match: null };

    const [made] = await t
      .insert(matches)
      .values({ profileA: a, profileB: b, createdAt: now })
      .onConflictDoNothing()
      .returning({ id: matches.id });
    if (!made) return { eventIds: [], match: null };
    // The answers did their job: the match is the record now.
    await t
      .delete(matchAnswers)
      .where(
        or(
          and(eq(matchAnswers.fromId, profileId), eq(matchAnswers.toId, target.id)),
          and(eq(matchAnswers.fromId, target.id), eq(matchAnswers.toId, profileId)),
        ),
      );
    const eventId = await recordEvent(t, {
      type: 'MatchCreated',
      actorId: profileId,
      payload: { matchId: made.id, profileIds: [a, b] },
    });
    const [person] = await present(
      t,
      me,
      [{ ...target, commonSlots: await commonSlotsOf(t, profileId, target.id) }],
      { now, supabaseUrl },
    );
    return { eventIds: [eventId], match: { id: made.id, person } };
  });
}

async function commonSlotsOf(db: AnyDb, a: string, b: string) {
  const rows = await db
    .select({ id: profiles.id, availability: profiles.availability })
    .from(profiles)
    .where(inArray(profiles.id, [a, b]));
  const [x, y] = rows.map((row) => row.availability);
  return slotsIn((x ?? 0) & (y ?? 0));
}

/**
 * "Voltar a última": takes back the person's latest answer of the last day, unless it made a match,
 * so that card comes back to the top of the deck. Nothing to take back: false.
 */
export async function undoLastAnswer(db: AnyDb, profileId: string, now = new Date()) {
  const [last] = await db
    .select({ toId: matchAnswers.toId })
    .from(matchAnswers)
    .where(
      and(
        eq(matchAnswers.fromId, profileId),
        gt(matchAnswers.createdAt, new Date(now.getTime() - DAY_MS)),
      ),
    )
    .orderBy(desc(matchAnswers.createdAt))
    .limit(1);
  if (!last) return { undone: false };
  await db
    .delete(matchAnswers)
    .where(and(eq(matchAnswers.fromId, profileId), eq(matchAnswers.toId, last.toId)));
  return { undone: true };
}

export type MatchListItem = { id: string; createdAt: Date; person: MatchPerson };
export type MatchList = { total: number; pages: number; items: MatchListItem[] };

/**
 * The person's matches, newest first, MATCHES_PAGE_SIZE a page; null past the last page. An undone
 * match, a block between the two or a suspended account takes the row out.
 */
export async function listMatches(
  db: AnyDb,
  profileId: string,
  page: number,
  { now = new Date(), supabaseUrl }: { now?: Date; supabaseUrl?: string } = {},
): Promise<MatchList | null> {
  const other = sql`case when ${matches.profileA} = ${profileId} then ${matches.profileB} else ${matches.profileA} end`;
  const where = and(
    or(eq(matches.profileA, profileId), eq(matches.profileB, profileId)),
    isNull(matches.endedAt),
    eq(profiles.status, 'active'),
    isNotNull(profiles.username),
    sql`not ${blockedWith(profileId)}`,
  );
  const [{ total }] = await db
    .select({ total: count() })
    .from(matches)
    .innerJoin(profiles, eq(profiles.id, other))
    .where(where);
  const pages = Math.max(1, Math.ceil(total / MATCHES_PAGE_SIZE));
  if (page > pages) return null;

  const rows = await db
    .select({
      matchId: matches.id,
      createdAt: matches.createdAt,
      id: profiles.id,
      username: profiles.username,
      name: profiles.name,
      showName: profiles.showName,
      avatarPath: profiles.avatarPath,
      avatarUrl: profiles.avatarUrl,
      tableRole: profiles.tableRole,
      city: profiles.city,
      showFavoriteSystems: profiles.showFavoriteSystems,
      card: matchCards,
      availability: profiles.availability,
    })
    .from(matches)
    .innerJoin(profiles, eq(profiles.id, other))
    .leftJoin(matchCards, eq(matchCards.profileId, profiles.id))
    .where(where)
    .orderBy(desc(matches.createdAt))
    .limit(MATCHES_PAGE_SIZE)
    .offset((page - 1) * MATCHES_PAGE_SIZE);

  const [mine] = await db
    .select({ city: profiles.city, availability: profiles.availability, card: matchCards })
    .from(profiles)
    .leftJoin(matchCards, eq(matchCards.profileId, profiles.id))
    .where(eq(profiles.id, profileId));
  const fallback: Card = {
    profileId,
    enabledAt: null,
    adultConfirmedAt: now,
    seeking: [],
    online: true,
    inPerson: false,
    axisCombat: 50,
    axisRules: 50,
    axisLength: 50,
    axisTone: 50,
    createdAt: now,
    updatedAt: now,
  };
  const me: Me = { id: profileId, card: mine?.card ?? fallback, city: mine?.city ?? null };
  const people = await present(
    db,
    me,
    rows.map((row) => ({
      ...row,
      // A card switched off after the match still draws: with its last values, or the middle.
      card: row.card ?? { ...fallback, profileId: row.id },
      commonSlots: slotsIn(row.availability & (mine?.availability ?? 0)),
      score: 0,
    })),
    { now, supabaseUrl },
  );
  return {
    total,
    pages,
    items: rows.map((row, i) => ({ id: row.matchId, createdAt: row.createdAt, person: people[i] })),
  };
}

/**
 * "Desfazer combinação": the match leaves both lists for good and the two never meet in the deck
 * again. Their conversation, if they started one, stays in Mensagens (blocking closes it).
 */
export async function endMatch(db: AnyDb, profileId: string, matchId: string, now = new Date()) {
  const [ended] = await db
    .update(matches)
    .set({ endedAt: now, endedBy: profileId })
    .where(
      and(
        eq(matches.id, matchId),
        isNull(matches.endedAt),
        or(eq(matches.profileA, profileId), eq(matches.profileB, profileId)),
      ),
    )
    .returning({ id: matches.id });
  if (!ended) throw new NotFound();
  const eventId = await recordEvent(db, {
    type: 'MatchEnded',
    actorId: profileId,
    payload: { matchId },
  });
  return { eventIds: [eventId] };
}

/** The sweep: answers older than MATCH_ANSWER_DAYS go (a match that came of one stays). */
export async function pruneMatchAnswers(db: AnyDb, now = new Date()): Promise<number> {
  const removed = await db
    .delete(matchAnswers)
    .where(lt(matchAnswers.createdAt, new Date(now.getTime() - MATCH_ANSWER_DAYS * DAY_MS)))
    .returning({ fromId: matchAnswers.fromId });
  return removed.length;
}

/** A closed account: its card and every answer it gave or got go. Its matches end. */
export async function eraseMatchesOf(db: AnyDb, profileId: string, now = new Date()) {
  await db.delete(matchCards).where(eq(matchCards.profileId, profileId));
  await db
    .delete(matchAnswers)
    .where(or(eq(matchAnswers.fromId, profileId), eq(matchAnswers.toId, profileId)));
  await db
    .update(matches)
    .set({ endedAt: now, endedBy: profileId })
    .where(
      and(
        isNull(matches.endedAt),
        or(eq(matches.profileA, profileId), eq(matches.profileB, profileId)),
      ),
    );
}
