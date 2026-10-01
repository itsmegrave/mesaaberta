import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, gameTables, profiles, ratings, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import type { Actor } from '../auth/policy';
import { joinTable, leaveTable, removePlayer } from '../registrations/service';
import { firstSessionEnded, gmRating, ratingOf, submitRating } from './service';

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
  const seat = await joinTable(test.db, player(n), slug);
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

  it('can be edited later: one rating per player, and the latest wins', async () => {
    const table = await makeTable();
    await seated(2, table.slug);

    await submitRating(test.db, player(2), table.slug, input({ gmScore: 2 }), after);
    await submitRating(
      test.db,
      player(2),
      table.slug,
      input({ gmScore: 5, comment: 'Melhorou.' }),
      after,
    );

    const rows = await test.db.select().from(ratings).where(eq(ratings.tableId, table.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ gmScore: 5, comment: 'Melhorou.' });
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

describe('when a player goes, their rating goes with them', () => {
  it('is deleted when the GM removes the player', async () => {
    const table = await makeTable();
    await seated(2, table.slug);
    await submitRating(test.db, player(2), table.slug, input(), after);

    await removePlayer(test.db, gm, table.slug, id(2));

    expect(await ratingOf(test.db, table.id, id(2))).toBeNull();
  });

  it('is deleted when the player leaves', async () => {
    const table = await makeTable();
    await seated(2, table.slug);
    await submitRating(test.db, player(2), table.slug, input(), after);

    await leaveTable(test.db, player(2), table.slug);

    expect(await test.db.select().from(ratings).where(eq(ratings.tableId, table.id))).toHaveLength(
      0,
    );
  });
});

describe('averages, computed by a query', () => {
  it("gives a GM's average across all their tables", async () => {
    const otherGm = player(6);
    const a = await makeTable({ gmId: otherGm.id });
    const b = await makeTable({ gmId: otherGm.id });
    await seated(2, a.slug);
    await seated(3, b.slug);
    await submitRating(test.db, player(2), a.slug, input({ gmScore: 5 }), after);
    await submitRating(test.db, player(3), b.slug, input({ gmScore: 4 }), after);

    expect(await gmRating(test.db, otherGm.id)).toEqual({ average: 4.5, count: 2 });
  });

  it('is null, with a count of zero, when nobody has rated', async () => {
    expect(await gmRating(test.db, id(5))).toEqual({ average: null, count: 0 });
  });

  it("follows the data: a removed player's rating stops counting", async () => {
    const table = await makeTable({ gmId: id(4) });
    await seated(2, table.slug);
    await seated(3, table.slug);
    await submitRating(test.db, player(2), table.slug, input({ gmScore: 1 }), after);
    await submitRating(test.db, player(3), table.slug, input({ gmScore: 5 }), after);
    expect((await gmRating(test.db, id(4))).average).toBe(3);

    await removePlayer(test.db, { id: id(4), role: 'member', status: 'active' }, table.slug, id(2));

    expect(await gmRating(test.db, id(4))).toEqual({ average: 5, count: 1 });
  });
});
