import { and, eq, inArray, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, playerRatings, registrations } from '../db/schema';
import { can, type Actor } from '../auth/policy';
import { AlreadyRated, Forbidden, NotFound } from '../errors';
import { recordEvent } from '../events/outbox';
import { markedPresent } from '../tables/attendance';
import type { PlayerRatingInput } from '../../tables/rating';
import { NEUTRAL_MEAN, gmScore, monthStart } from '../../ratings/gm-score';
import type { GmRating } from './service';

/**
 * The GM rates a player of their table (`player:rate`): one they marked present, at a table whose
 * session happened. One rating per player and table, and it is final: a second attempt throws
 * `AlreadyRated` and nothing edits it.
 */
export async function ratePlayer(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  playerId: string,
  input: PlayerRatingInput,
) {
  return db.transaction(async (tx) => {
    const [table] = await tx.select().from(gameTables).where(eq(gameTables.slug, slug));
    if (!table) throw new NotFound(`no table with slug "${slug}"`);

    const [seat] = await tx
      .select({ status: registrations.status, attended: registrations.attended })
      .from(registrations)
      .where(and(eq(registrations.tableId, table.id), eq(registrations.playerId, playerId)));

    const allowed = can(actor, 'player:rate', {
      gmId: table.gmId,
      tableStatus: table.status,
      kind: table.kind,
      markedPresent: seat !== undefined && markedPresent(seat),
    });
    if (!allowed) throw new Forbidden('player:rate');

    const inserted = await tx
      .insert(playerRatings)
      .values({ tableId: table.id, playerId, score: input.score, comment: input.comment })
      .onConflictDoNothing()
      .returning({ tableId: playerRatings.tableId });
    if (inserted.length === 0) throw new AlreadyRated();

    const eventId = await recordEvent(tx as unknown as AnyDb, {
      type: 'PlayerRated',
      actorId: actor!.id,
      // No score or comment: the audit log keeps who and what, not opinions.
      payload: { tableId: table.id, slug: table.slug, playerId },
    });
    return { eventIds: [eventId] };
  });
}

/** The scores the GM gave at this table, by player. The comments stay out: the page only shows the stars. */
export async function playerRatingsAt(db: AnyDb, tableId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ playerId: playerRatings.playerId, score: playerRatings.score })
    .from(playerRatings)
    .where(eq(playerRatings.tableId, tableId));
  return new Map(rows.map((row) => [row.playerId, row.score]));
}

/**
 * The public scores "como participante" of these people, worked out like a GM's (`gmScore`: the
 * same weights, prior and minimum), against the mean of every player rating on the site. Everyone
 * asked for is in the map, with no ratings when they have none. Not cached: a page asks for a few
 * people, each with a handful of ratings.
 */
export async function participantRatings(
  db: AnyDb,
  playerIds: string[],
  now = new Date(),
): Promise<Map<string, GmRating>> {
  const wanted = [...new Set(playerIds)];
  const found = new Map<string, GmRating>();
  if (wanted.length === 0) return found;

  const [rows, [overall]] = await Promise.all([
    db
      .select({
        playerId: playerRatings.playerId,
        score: playerRatings.score,
        updatedAt: playerRatings.updatedAt,
      })
      .from(playerRatings)
      .where(inArray(playerRatings.playerId, wanted)),
    db.select({ mean: sql<number | null>`avg(${playerRatings.score})::float` }).from(playerRatings),
  ]);
  const globalMean = overall?.mean ?? NEUTRAL_MEAN;
  // Ages count from the first of the month, as for GMs, so a score holds still inside a month.
  const { date } = monthStart(now);

  for (const playerId of wanted) {
    const { score, count, isNew } = gmScore({
      ratings: rows.filter((row) => row.playerId === playerId),
      globalMean,
      now: date,
    });
    found.set(playerId, { score, count, isNew });
  }
  return found;
}

/** One person's score as a participant. Prefer `participantRatings` where there is a list. */
export async function participantRatingOf(
  db: AnyDb,
  playerId: string,
  now = new Date(),
): Promise<GmRating> {
  return (await participantRatings(db, [playerId], now)).get(playerId)!;
}
