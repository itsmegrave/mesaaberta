import { describe, expect, it } from 'vitest';
import { startingSoon } from './starting-soon';

const now = new Date('2026-10-29T18:00:00Z');
const at = (hours: number, seatsLeft = 1, slug = `t${hours}`) => ({
  slug,
  seatsLeft,
  startsAt: new Date(now.getTime() + hours * 3_600_000),
});

describe('startingSoon', () => {
  it('keeps the tables with a seat that start within six hours, soonest first, three at most', () => {
    const picked = startingSoon(
      [at(5), at(1), at(7), at(2, 0), at(3), at(4), at(-1, 1, 'past')],
      now,
    );

    expect(picked.map((table) => table.slug)).toEqual(['t1', 't3', 't4']);
  });

  it('leaves out a table without a date', () => {
    expect(startingSoon([{ slug: 'x', seatsLeft: 2, startsAt: null }], now)).toEqual([]);
  });
});
