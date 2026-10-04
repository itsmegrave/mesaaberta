// How a GM's score is worked out. The only number anyone sees: nobody, the GM included, is shown
// the plain average. Pure, so the server can test it without a database.

/**
 * The starting values, in one place to tune once there is volume.
 * - `priorWeight` (C): how many ratings' worth of the site-wide mean every GM starts with.
 * - `minRatings`: below this many ratings the GM is shown as new, with no score.
 * - `halfLifeMonths`: a rating loses half its weight every this many months.
 */
export const GM_SCORE = { priorWeight: 5, minRatings: 3, halfLifeMonths: 12 } as const;

/** What a site-wide mean falls back to when nothing has been rated anywhere yet: the middle. */
export const NEUTRAL_MEAN = 3;

const MONTH_MS = (365.25 / 12) * 24 * 60 * 60 * 1000;

export type GmScoreInput = {
  ratings: { score: number; updatedAt: Date }[];
  /** The mean of every rating on the site (`m`). */
  globalMean: number;
  /** The moment ages are counted from. The server passes the start of the month, see `gmRatings`. */
  now: Date;
};

export type GmScore = {
  /** The weighted, Bayesian score, or null when there are no ratings. Not for showing when `isNew`. */
  score: number | null;
  /** How many ratings count: all of them, whatever their age. */
  count: number;
  /** Fewer than `minRatings`: shown as "Novo mestre" instead of the score. */
  isNew: boolean;
};

/** A rating's weight: 1 when new, 0.5 after a half-life, and so on. A future date counts as new. */
export function ratingWeight(updatedAt: Date, now: Date): number {
  const ageMonths = Math.max(0, now.getTime() - updatedAt.getTime()) / MONTH_MS;
  return 0.5 ** (ageMonths / GM_SCORE.halfLifeMonths);
}

/** `(C × m + Σ wᵢ × scoreᵢ) / (C + Σ wᵢ)`, with `wᵢ = 0.5 ^ (age in months / half-life)`. */
export function gmScore({ ratings, globalMean, now }: GmScoreInput): GmScore {
  const count = ratings.length;
  if (count === 0) return { score: null, count, isNew: true };

  let weights = 0;
  let weighted = 0;
  for (const { score, updatedAt } of ratings) {
    const weight = ratingWeight(updatedAt, now);
    weights += weight;
    weighted += weight * score;
  }
  const { priorWeight } = GM_SCORE;

  return {
    score: (priorWeight * globalMean + weighted) / (priorWeight + weights),
    count,
    isNew: count < GM_SCORE.minRatings,
  };
}

/** The first day of `now`'s month in UTC, as the cache stores it (`2026-10-01`) and as a date. */
export function monthStart(now: Date): { key: string; date: Date } {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { key: date.toISOString().slice(0, 10), date };
}
