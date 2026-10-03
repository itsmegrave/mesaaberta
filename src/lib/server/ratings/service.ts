import { and, eq, inArray, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, gmScores, ratings, registrations } from '../db/schema';
import { rateBlocker, type Actor } from '../auth/policy';
import { AlreadyRated, Forbidden, NotFound, TooEarly } from '../errors';
import { recordEvent } from '../events/outbox';
import type { RatingInput } from '$lib/tables/rating';
import { GM_SCORE, NEUTRAL_MEAN, gmScore, monthStart } from '$lib/ratings/gm-score';

/** Whether the first session is over. You rate what you played; a campaign is rated after its first session. */
export const firstSessionEnded = (
  table: { startsAt: Date; durationMinutes: number },
  now: Date,
): boolean => table.startsAt.getTime() + table.durationMinutes * 60_000 <= now.getTime();

/**
 * A player rates the GM of a table they played at. Needs a confirmed seat, not being the GM, and a
 * session the GM confirmed happened (`rateBlocker`). One rating per player and table, and it is
 * final: a second attempt throws `AlreadyRated`, nothing edits it, and it outlives the seat.
 */
export async function submitRating(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  input: RatingInput,
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [table] = await tx.select().from(gameTables).where(eq(gameTables.slug, slug));
    if (!table) throw new NotFound(`no table with slug "${slug}"`);

    const [registration] = actor
      ? await tx
          .select({ status: registrations.status })
          .from(registrations)
          .where(and(eq(registrations.tableId, table.id), eq(registrations.playerId, actor.id)))
      : [];

    const blocker = rateBlocker(actor, {
      gmId: table.gmId,
      registration: registration?.status ?? null,
      tableStatus: table.status,
      firstSessionEnded: firstSessionEnded(table, now),
    });
    if (blocker === 'too_early') throw new TooEarly();
    if (blocker) throw new Forbidden('table:rate');

    const inserted = await tx
      .insert(ratings)
      .values({
        tableId: table.id,
        playerId: actor!.id,
        gmScore: input.gmScore,
        comment: input.comment,
      })
      .onConflictDoNothing()
      .returning({ tableId: ratings.tableId });
    if (inserted.length === 0) throw new AlreadyRated();

    const eventId = await recordEvent(tx as unknown as AnyDb, {
      type: 'RatingSubmitted',
      actorId: actor!.id,
      // No scores or comment: the audit log keeps who and what, not opinions.
      payload: { tableId: table.id, slug: table.slug, playerId: actor!.id },
    });
    return { eventIds: [eventId] };
  });
}

/** A player's own rating of a table, or null. */
export async function ratingOf(db: AnyDb, tableId: string, playerId: string) {
  const [rating] = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.tableId, tableId), eq(ratings.playerId, playerId)));

  return rating ?? null;
}

export type GmRating = { score: number | null; count: number; isNew: boolean };

const view = (score: number | null, count: number): GmRating => ({
  score,
  count,
  isNew: count < GM_SCORE.minRatings,
});

/**
 * The scores of these GMs (see `gmScore`), many at once so a list costs one query. Each is kept in
 * `gm_scores` and worked out again only when it can have changed: the month turned (ratings age by
 * months, so ages are counted from the first of the month and the value cannot drift inside it), or
 * a rating was added or removed (a trigger raises `version`). A GM with no ratings is in the map too.
 */
export async function gmRatings(
  db: AnyDb,
  gmIds: string[],
  now = new Date(),
): Promise<Map<string, GmRating>> {
  const wanted = [...new Set(gmIds)];
  const found = new Map<string, GmRating>();
  if (wanted.length === 0) return found;

  const { key, date } = monthStart(now);
  const kept = new Map(
    (await db.select().from(gmScores).where(inArray(gmScores.gmId, wanted))).map((row) => [
      row.gmId,
      row,
    ]),
  );
  // The version is read before the ratings: if one arrives while this works, the write below
  // finds the version moved and leaves the row stale for the next reader.
  const stale: { gmId: string; version: number }[] = [];
  for (const gmId of wanted) {
    const row = kept.get(gmId);
    if (row && row.month === key && row.version === row.computedVersion) {
      found.set(gmId, view(row.score, row.count));
    } else {
      stale.push({ gmId, version: row?.version ?? 0 });
    }
  }
  if (stale.length === 0) return found;

  const [rows, [overall]] = await Promise.all([
    db
      .select({ gmId: gameTables.gmId, score: ratings.gmScore, updatedAt: ratings.updatedAt })
      .from(ratings)
      .innerJoin(gameTables, eq(ratings.tableId, gameTables.id))
      .where(
        inArray(
          gameTables.gmId,
          stale.map((entry) => entry.gmId),
        ),
      ),
    db.select({ mean: sql<number | null>`avg(${ratings.gmScore})::float` }).from(ratings),
  ]);
  const globalMean = overall?.mean ?? NEUTRAL_MEAN;

  for (const { gmId, version } of stale) {
    const result = gmScore({
      ratings: rows.filter((row) => row.gmId === gmId),
      globalMean,
      now: date,
    });
    found.set(gmId, view(result.score, result.count));
    try {
      await db
        .insert(gmScores)
        .values({
          gmId,
          score: result.score,
          count: result.count,
          month: key,
          version,
          computedVersion: version,
        })
        .onConflictDoUpdate({
          target: gmScores.gmId,
          set: { score: result.score, count: result.count, month: key, computedVersion: version },
          setWhere: eq(gmScores.version, version),
        });
    } catch {
      // The cache is an optimisation: a failed write only means working it out again next time.
    }
  }

  return found;
}

/** One GM's score. Prefer `gmRatings` where there is a list. */
export async function gmRatingOf(db: AnyDb, gmId: string, now = new Date()): Promise<GmRating> {
  return (await gmRatings(db, [gmId], now)).get(gmId)!;
}
