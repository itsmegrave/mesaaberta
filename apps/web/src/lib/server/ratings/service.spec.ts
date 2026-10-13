import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { events, gameTables, gmScores, profiles, ratings, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import type { Actor } from '../auth/policy';
import { joinTable, leaveTable, removePlayer } from '../registrations/service';
import { closeAccount } from '../account/service';
import { firstSessionEnded, gmRatingOf, gmRatings, ratingOf, submitRating } from './service';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000020${String(n).padStart(2, '0')}`;
const player = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const gm = player(1);
const admin: Actor = { id: id(90), role: 'admin', status: 'active' };
const past = new Date('2026-01-01T20:00:00Z');
const after = new Date('2026-06-01T00:00:00Z'); // long after the first session
const before = new Date('2025-12-01T00:00:00Z');
let counter = 0;

beforeAll(async () => {
  test = await createTestDb();
  await test.db
    .insert(profiles)
    .values([
      ...Array.from({ length: 6 }, (_, i) => ({ id: id(i + 1), username: `p${i + 1}` })),
      { id: id(90), username: 'admin', role: 'admin' as const },
    ]);
});
afterAll(() => test.close());

// Where each table ends up once its players have joined: the GM said the session happened (only
// then is there something to rate), unless a test says otherwise.
const finalStatus = new Map<
  string,
  'concluded' | 'awaiting_confirmation' | 'not_held' | 'active'
>();

const makeTable = async (over: Partial<typeof gameTables.$inferInsert> = {}) => {
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const slug = `nota-${++counter}`;
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: slug,
      kind: 'one_shot',
      capacity: 5,
      startsAt: past,
      durationMinutes: 240,
      timezone: 'UTC',
      gmId: gm.id,
      systemId: system.id,
      ...over,
      // Players join while it is open (see `seated`).
      status: 'active',
    })
    .returning();
  finalStatus.set(table.slug, (over.status as never) ?? 'concluded');
  return table;
};

const input = (over: Partial<Parameters<typeof submitRating>[3]> = {}) => ({
  gmScore: 4,
  comment: null,
  ...over,
});

const seated = async (n: number, slug: string) => {
  await test.db.update(gameTables).set({ status: 'active' }).where(eq(gameTables.slug, slug));
  // The tables here started long ago; seats close at the start, so the player joins just before it.
  const seat = await joinTable(test.db, player(n), slug, {
    now: new Date(past.getTime() - 60_000),
  });
  await test.db
    .update(gameTables)
    .set({ status: finalStatus.get(slug) ?? 'concluded' })
    .where(eq(gameTables.slug, slug));
  return seat;
};

describe('firstSessionEnded', () => {
  const table = { startsAt: past, durationMinutes: 240 };

  it('is false until the first session is over, and true from the moment it ends', () => {
    expect(firstSessionEnded(table, new Date('2026-01-01T23:59:59Z'))).toBe(false);
    expect(firstSessionEnded(table, new Date('2026-01-02T00:00:00Z'))).toBe(true);
  });

  it('is about the first session only: a campaign that still has sessions ahead can be rated', () => {
    expect(
      firstSessionEnded({ startsAt: past, durationMinutes: 60 }, new Date('2026-01-10T00:00:00Z')),
    ).toBe(true);
  });
});

describe('submitRating', () => {
  it('stores both scores and the comment, and records RatingSubmitted', async () => {
    const table = await makeTable();
    await seated(2, table.slug);

    const { eventIds } = await submitRating(
      test.db,
      player(2),
      table.slug,
      input({ comment: 'Ótima.' }),
      after,
    );

    expect(await ratingOf(test.db, table.id, id(2))).toMatchObject({
      gmScore: 4,
      comment: 'Ótima.',
    });
    const [event] = (await test.db.select().from(events)).filter((e) => e.id === eventIds[0]);
    expect(event).toMatchObject({
      type: 'RatingSubmitted',
      actorId: id(2),
      payload: { slug: table.slug, playerId: id(2) },
    });
    expect(JSON.stringify(event.payload)).not.toContain('Ótima');
  });

  it('is final: a second rating is refused with AlreadyRated and changes nothing', async () => {
    const table = await makeTable();
    await seated(2, table.slug);
    await submitRating(
      test.db,
      player(2),
      table.slug,
      input({ gmScore: 2, comment: 'Foi ok.' }),
      after,
    );

    await expect(
      submitRating(
        test.db,
        player(2),
        table.slug,
        input({ gmScore: 5, comment: 'Melhorou.' }),
        after,
      ),
    ).rejects.toMatchObject({ name: 'AlreadyRated' });

    const rows = await test.db.select().from(ratings).where(eq(ratings.tableId, table.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ gmScore: 2, comment: 'Foi ok.' });
  });

  it('refuses a rating before the first session has ended, with TooEarly', async () => {
    const table = await makeTable();
    await seated(2, table.slug);

    await expect(
      submitRating(test.db, player(2), table.slug, input(), before),
    ).rejects.toMatchObject({
      name: 'TooEarly',
    });
    expect(await ratingOf(test.db, table.id, id(2))).toBeNull();
  });

  it.each(['active', 'awaiting_confirmation', 'not_held'] as const)(
    'refuses a rating while the table is %s, even after its session: the GM has not said it happened',
    async (status) => {
      const table = await makeTable({ status });
      await seated(2, table.slug);

      await expect(
        submitRating(test.db, player(2), table.slug, input(), after),
      ).rejects.toMatchObject({ name: 'TooEarly' });
      expect(await ratingOf(test.db, table.id, id(2))).toBeNull();
    },
  );

  it.each([
    ['the GM of the table', () => gm],
    ['an admin who never had a seat', () => admin],
    ['an anonymous visitor', () => null],
    ['someone who has no seat', () => player(5)],
  ])('refuses %s', async (_who, who) => {
    const table = await makeTable();
    await seated(2, table.slug);

    await expect(submitRating(test.db, who(), table.slug, input(), after)).rejects.toMatchObject({
      name: 'Forbidden',
    });
  });

  it('refuses a player whose request is still pending, since they did not play', async () => {
    const table = await makeTable({ joinMode: 'approval' });
    await seated(2, table.slug); // pending

    await expect(
      submitRating(test.db, player(2), table.slug, input(), after),
    ).rejects.toMatchObject({
      name: 'Forbidden',
    });
  });

  it('is NotFound for a table that does not exist', async () => {
    await expect(
      submitRating(test.db, player(2), 'nao-existe', input(), after),
    ).rejects.toMatchObject({
      name: 'NotFound',
    });
  });
});

describe('a rating outlives the seat', () => {
  it('stays when the GM removes the player', async () => {
    const table = await makeTable();
    await seated(2, table.slug);
    await submitRating(test.db, player(2), table.slug, input({ comment: 'Boa.' }), after);

    await removePlayer(test.db, gm, table.slug, id(2));

    expect(await ratingOf(test.db, table.id, id(2))).toMatchObject({ gmScore: 4, comment: 'Boa.' });
  });

  it('stays when the player leaves, and they still cannot rate again', async () => {
    const table = await makeTable();
    await seated(2, table.slug);
    await submitRating(test.db, player(2), table.slug, input(), after);

    await leaveTable(test.db, player(2), table.slug);

    expect(await test.db.select().from(ratings).where(eq(ratings.tableId, table.id))).toHaveLength(
      1,
    );
  });
});

describe("a GM's score", () => {
  const october = new Date('2026-10-15T12:00:00Z');
  const november = new Date('2026-11-02T12:00:00Z');
  const rate = async (gmId: string, scores: number[]) => {
    // Anyone but the GM can rate: a GM cannot sit at their own table.
    const raters = [2, 3, 4, 5, 6].filter((n) => id(n) !== gmId);
    for (const [i, gmScore] of scores.entries()) {
      const rater = raters[i % raters.length];
      const table = await makeTable({ gmId });
      await seated(rater, table.slug);
      await submitRating(test.db, player(rater), table.slug, input({ gmScore }), after);
    }
  };
  const cached = async (gmId: string) =>
    (await test.db.select().from(gmScores).where(eq(gmScores.gmId, gmId)))[0];

  it('is new, with no score and a count of zero, for a GM nobody has rated', async () => {
    expect(await gmRatingOf(test.db, id(5), october)).toEqual({
      score: null,
      count: 0,
      isNew: true,
    });
  });

  it('is new below three ratings, and the count is still there', async () => {
    await rate(id(5), [5, 5]);

    expect(await gmRatingOf(test.db, id(5), october)).toMatchObject({ count: 2, isNew: true });
  });

  it('has a weighted score from three ratings on, pulled toward the mean of the site', async () => {
    await rate(id(6), [5, 5, 5]);

    const rating = await gmRatingOf(test.db, id(6), october);

    expect(rating).toMatchObject({ count: 3, isNew: false });
    // Three fives are not a five: the site-wide mean holds some of the weight.
    expect(rating.score).toBeGreaterThan(3);
    expect(rating.score).toBeLessThan(5);
  });

  it('works out many GMs in one go, new ones included', async () => {
    const found = await gmRatings(test.db, [id(5), id(6), id(4), id(5)], october);

    expect([...found.keys()].sort()).toEqual([id(4), id(5), id(6)].sort());
  });

  it('keeps the score and does not work it out again until it can have changed', async () => {
    const gmId = id(3);
    await rate(gmId, [4, 4, 4]);
    await gmRatingOf(test.db, gmId, october);
    expect(await cached(gmId)).toMatchObject({ count: 3, month: '2026-10-01' });
    expect((await cached(gmId))!.version).toBe((await cached(gmId))!.computedVersion);

    // A marker the real calculation could never give: if it comes back, nothing was recomputed.
    await test.db.update(gmScores).set({ score: 1.234 }).where(eq(gmScores.gmId, gmId));
    expect((await gmRatingOf(test.db, gmId, october)).score).toBe(1.234);
    // Later in the same month: still the same value.
    expect((await gmRatingOf(test.db, gmId, new Date('2026-10-31T23:00:00Z'))).score).toBe(1.234);
  });

  it('is worked out again when the month turns', async () => {
    const gmId = id(3);
    await test.db.update(gmScores).set({ score: 1.234 }).where(eq(gmScores.gmId, gmId));

    const rating = await gmRatingOf(test.db, gmId, november);

    expect(rating.score).not.toBe(1.234);
    expect(await cached(gmId)).toMatchObject({ month: '2026-11-01' });
  });

  it('is worked out again when the GM gets a new rating', async () => {
    const gmId = id(3);
    await gmRatingOf(test.db, gmId, november);
    await test.db.update(gmScores).set({ score: 1.234 }).where(eq(gmScores.gmId, gmId));
    expect((await gmRatingOf(test.db, gmId, november)).score).toBe(1.234);

    await rate(gmId, [1]);

    const rating = await gmRatingOf(test.db, gmId, november);
    expect(rating.count).toBe(4);
    expect(rating.score).not.toBe(1.234);
  });

  it("notices a GM's first rating even though they had no cached row yet", async () => {
    const gmId = id(2);
    expect(await cached(gmId)).toBeUndefined();

    await rate(gmId, [5]);

    expect(await cached(gmId)).toMatchObject({ version: 1, computedVersion: 0 });
    expect((await gmRatingOf(test.db, gmId, october)).count).toBe(1);
  });

  it('does not change when a player leaves or is removed: the rating stays', async () => {
    const gmId = id(4);
    const table = await makeTable({ gmId });
    await seated(2, table.slug);
    await submitRating(test.db, player(2), table.slug, input({ gmScore: 1 }), after);
    const before = await gmRatingOf(test.db, gmId, october);

    await removePlayer(test.db, { id: gmId, role: 'member', status: 'active' }, table.slug, id(2));

    expect(await gmRatingOf(test.db, gmId, october)).toEqual(before);
  });
});

describe('closing an account', () => {
  it("deletes the ratings of the GM's tables and their score, but not the tables", async () => {
    const gmId = id(6);
    expect((await gmRatingOf(test.db, gmId)).count).toBeGreaterThan(0);
    const tables = await test.db.select().from(gameTables).where(eq(gameTables.gmId, gmId));
    expect(tables.length).toBeGreaterThan(0);

    await closeAccount(test.db, gmId);

    expect(await test.db.select().from(gameTables).where(eq(gameTables.gmId, gmId))).toHaveLength(
      tables.length,
    );
    expect(
      await test.db
        .select()
        .from(ratings)
        .where(
          inArray(
            ratings.tableId,
            tables.map((table) => table.id),
          ),
        ),
    ).toHaveLength(0);
    expect(await test.db.select().from(gmScores).where(eq(gmScores.gmId, gmId))).toHaveLength(0);
    expect((await gmRatingOf(test.db, gmId)).count).toBe(0);
  });

  it("a finished table stays as it was when its GM's account closes", async () => {
    const gmId = id(1);
    const table = await makeTable({ gmId });
    await seated(2, table.slug);
    await test.db
      .update(gameTables)
      .set({ status: 'concluded' })
      .where(eq(gameTables.id, table.id));

    await closeAccount(test.db, gmId);

    const [kept] = await test.db.select().from(gameTables).where(eq(gameTables.id, table.id));
    expect(kept.status).toBe('concluded');
  });

  it('keeps the score a player gave, final, and erases only the comment', async () => {
    const otherGm = id(4);
    const table = await makeTable({ gmId: otherGm });
    await seated(5, table.slug);
    await submitRating(
      test.db,
      player(5),
      table.slug,
      input({ gmScore: 3, comment: 'Segredo.' }),
      after,
    );
    const before = (await gmRatingOf(test.db, otherGm)).count;

    await closeAccount(test.db, id(5));

    expect(await ratingOf(test.db, table.id, id(5))).toMatchObject({ gmScore: 3, comment: null });
    expect((await gmRatingOf(test.db, otherGm)).count).toBe(before);
  });
});
