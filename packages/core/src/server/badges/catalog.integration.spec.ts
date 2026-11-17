import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/client';
import { BADGES, statsFor } from './catalog';

// The production client (postgres.js, `fetch_types: false`), not PGlite: a Date bound inside a raw
// `sql` fragment passes PGlite but fails postgres.js at Bind (Sentry MESA-ABERTA-APP-1Q).
const { db, close } = createDb(process.env.DATABASE_URL!);

afterAll(() => close());

describe('badge rules against the real driver', () => {
  it.each(BADGES.map((rule) => [rule.id, rule] as const))(
    '%s measures without failing',
    async (_, rule) => {
      const stats = statsFor(db, crypto.randomUUID());

      await expect(rule.measure(stats)).resolves.toBeTypeOf('number');
    },
  );

  it('checks the recent record behind "Presença confiável"', async () => {
    await expect(statsFor(db, crypto.randomUUID()).recentlyUnreliable()).resolves.toBe(false);
  });
});
