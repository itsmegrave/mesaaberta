import { describe, expect, it } from 'vitest';
import { GM_SCORE, gmScore, monthStart, ratingWeight } from './gm-score';

const now = new Date('2026-10-01T00:00:00Z');
const monthsAgo = (months: number) => new Date(now.getTime() - months * (365.25 / 12) * 864e5);
const rated = (scores: number[], ago = 0) =>
  scores.map((score) => ({ score, updatedAt: monthsAgo(ago) }));

describe('gmScore', () => {
  it('has no score and is new for a GM with no ratings', () => {
    expect(gmScore({ ratings: [], globalMean: 4, now })).toEqual({
      score: null,
      count: 0,
      isNew: true,
    });
  });

  it('is new with a single rating, whatever it is, and counts it', () => {
    const result = gmScore({ ratings: rated([5]), globalMean: 3.5, now });

    expect(result).toMatchObject({ count: 1, isNew: true });
  });

  it('is new just below the minimum, and not from the minimum on', () => {
    const below = gmScore({ ratings: rated([4, 4]), globalMean: 4, now });
    const at = gmScore({ ratings: rated([4, 4, 4]), globalMean: 4, now });

    expect([below.isNew, at.isNew]).toEqual([true, false]);
    expect(GM_SCORE.minRatings).toBe(3);
  });

  it('puts one five below forty ratings averaging 4.8 once both are past the minimum', () => {
    const veteran = gmScore({ ratings: rated(Array(40).fill(4.8)), globalMean: 4, now });
    const lucky = gmScore({ ratings: rated([5, 5, 5]), globalMean: 4, now });

    expect(veteran.score!).toBeGreaterThan(lucky.score!);
  });

  it('follows the formula: (C·m + Σ w·score) / (C + Σ w)', () => {
    // Two fresh ratings (w = 1) and one of a year ago (w = 0.5); C = 5, m = 3.
    const result = gmScore({
      ratings: [...rated([5, 4]), ...rated([2], 12)],
      globalMean: 3,
      now,
    });

    expect(result.score).toBeCloseTo((5 * 3 + 5 + 4 + 0.5 * 2) / (5 + 1 + 1 + 0.5), 10);
  });

  it('lets old ratings lose weight: the same ratings, older, count for less', () => {
    const recent = gmScore({ ratings: rated([5, 5, 5]), globalMean: 3, now });
    const old = gmScore({ ratings: rated([5, 5, 5], 36), globalMean: 3, now });

    expect(old.score!).toBeLessThan(recent.score!);
    expect(old.score!).toBeGreaterThan(3);
    // Still counted, only weighed less.
    expect(old.count).toBe(3);
  });

  it('converges to the true average of a GM with many ratings', () => {
    const scores = Array.from({ length: 500 }, (_, i) => (i % 5 === 0 ? 5 : 4)); // mean 4.2
    const result = gmScore({ ratings: rated(scores), globalMean: 2, now });

    expect(result.score!).toBeCloseTo(4.2, 1);
  });

  it('is the global mean when the GM has only the prior behind them', () => {
    expect(ratingWeight(now, now)).toBe(1);
  });
});

describe('ratingWeight', () => {
  it.each([
    [0, 1],
    [12, 0.5],
    [24, 0.25],
    [6, Math.SQRT1_2],
  ])('is %d months old: weighs %d', (months, weight) => {
    expect(ratingWeight(monthsAgo(months), now)).toBeCloseTo(weight, 6);
  });

  it('treats a rating dated after the reference as brand new', () => {
    expect(ratingWeight(new Date('2026-10-20T00:00:00Z'), now)).toBe(1);
  });
});

describe('monthStart', () => {
  it('is the first of the month in UTC, whatever the day', () => {
    expect(monthStart(new Date('2026-10-31T23:59:59Z')).key).toBe('2026-10-01');
    expect(monthStart(new Date('2026-11-01T00:00:00Z')).key).toBe('2026-11-01');
  });
});
