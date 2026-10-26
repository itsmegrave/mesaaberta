import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  events,
  gameTables,
  playerRatings,
  profiles,
  registrations,
  systems,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { closeAccount, exportAccount } from '@mesaaberta/core/server/account/service';
import { AlreadyRated, Forbidden, NotFound } from '@mesaaberta/core/server/errors';
import {
  participantRatingOf,
  participantRatings,
  playerRatingsAt,
  ratePlayer,
} from '@mesaaberta/core/server/ratings/players';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000031${String(n).padStart(2, '0')}`;
const person = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const gm = person(1);
const otherGm = person(2);
const admin: Actor = { id: id(90), role: 'admin', status: 'active' };
let counter = 0;

beforeAll(async () => {
  test = await createTestDb();
  await test.db
    .insert(profiles)
    .values([
      ...Array.from({ length: 8 }, (_, i) => ({ id: id(i + 1), username: `pr${i + 1}` })),
      { id: id(90), username: 'pr-admin', role: 'admin' as const },
    ]);
});
afterAll(() => test.close());

type Status = 'active' | 'awaiting_confirmation' | 'concluded' | 'not_held' | 'disabled';

/** A table of `gmId` with these seats: `true` marked present, `false` absent, `null` not recorded. */
const makeTable = async (
  {
    kind = 'one_shot',
    status = 'concluded',
    gmId = gm.id,
  }: { kind?: 'one_shot' | 'campaign' | 'adventure'; status?: Status; gmId?: string } = {},
  seats: Record<number, boolean | null> = {},
) => {
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const slug = `quem-joga-${++counter}`;
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: slug,
      kind,
      capacity: 6,
      startsAt: new Date('2026-01-01T20:00:00Z'),
      durationMinutes: 240,
      timezone: 'UTC',
      gmId,
      systemId: system.id,
      status,
      ...(kind === 'campaign' ? { recurrence: 'FREQ=WEEKLY;INTERVAL=1' } : {}),
    })
    .returning();
  const rows = Object.entries(seats).map(([n, attended]) => ({
    tableId: table.id,
    playerId: id(Number(n)),
    status: 'confirmed' as const,
    attended,
  }));
  if (rows.length > 0) await test.db.insert(registrations).values(rows);
  return table;
};

const score = (value = 4, comment: string | null = null) => ({ score: value, comment });

describe('ratePlayer', () => {
  it('lets the GM rate a player they marked present, once, and records who without the score', async () => {
    const table = await makeTable({}, { 3: true });

    const { eventIds } = await ratePlayer(test.db, gm, table.slug, id(3), score(5, 'Chegou cedo.'));

    const [row] = await test.db
      .select()
      .from(playerRatings)
      .where(eq(playerRatings.tableId, table.id));
    expect(row).toMatchObject({ playerId: id(3), score: 5, comment: 'Chegou cedo.' });
    const [event] = await test.db.select().from(events).where(eq(events.id, eventIds[0]));
    expect(event).toMatchObject({
      type: 'PlayerRated',
      actorId: gm.id,
      payload: { tableId: table.id, slug: table.slug, playerId: id(3) },
    });
    await expect(ratePlayer(test.db, gm, table.slug, id(3), score(1))).rejects.toBeInstanceOf(
      AlreadyRated,
    );
    expect((await playerRatingsAt(test.db, table.id)).get(id(3))).toBe(5);
  });

  it('refuses a player marked absent, one never marked, and someone with no seat', async () => {
    const table = await makeTable({}, { 3: false, 4: null });
    for (const playerId of [id(3), id(4), id(5)])
      await expect(ratePlayer(test.db, gm, table.slug, playerId, score())).rejects.toBeInstanceOf(
        Forbidden,
      );
  });

  it('refuses anyone but the table GM, admins included', async () => {
    const table = await makeTable({}, { 3: true });
    for (const actor of [otherGm, admin, person(3), null])
      await expect(ratePlayer(test.db, actor, table.slug, id(3), score())).rejects.toBeInstanceOf(
        Forbidden,
      );
  });

  it('refuses a session that did not happen and a table taken down', async () => {
    for (const status of ['not_held', 'disabled'] as const) {
      const table = await makeTable({ status, kind: 'campaign' }, { 3: true });
      await expect(ratePlayer(test.db, gm, table.slug, id(3), score())).rejects.toBeInstanceOf(
        Forbidden,
      );
    }
  });

  it('waits for the confirmation on a one-shot, but not on a campaign or adventure that goes on', async () => {
    const oneShot = await makeTable({ status: 'awaiting_confirmation' }, { 3: true });
    await expect(ratePlayer(test.db, gm, oneShot.slug, id(3), score())).rejects.toBeInstanceOf(
      Forbidden,
    );

    const campaign = await makeTable({ kind: 'campaign', status: 'active' }, { 3: true });
    await ratePlayer(test.db, gm, campaign.slug, id(3), score());
    const adventure = await makeTable(
      { kind: 'adventure', status: 'awaiting_confirmation' },
      { 3: true },
    );
    await ratePlayer(test.db, gm, adventure.slug, id(3), score());
  });

  it('answers NotFound for an unknown table', async () => {
    await expect(ratePlayer(test.db, gm, 'nao-existe', id(3), score())).rejects.toBeInstanceOf(
      NotFound,
    );
  });

  it('refuses a score out of range at the database too', async () => {
    const table = await makeTable({}, { 3: true });
    await expect(ratePlayer(test.db, gm, table.slug, id(3), score(6))).rejects.toThrow();
  });
});

describe('participantRatings', () => {
  it('shows a debut below three ratings, then the weighted score, for everyone asked', async () => {
    const tables = await Promise.all([5, 4, 5].map(() => makeTable({}, { 6: true, 7: true })));
    await ratePlayer(test.db, gm, tables[0].slug, id(6), score(5));
    await ratePlayer(test.db, gm, tables[1].slug, id(6), score(4));
    expect(await participantRatingOf(test.db, id(6))).toMatchObject({ count: 2, isNew: true });

    await ratePlayer(test.db, gm, tables[2].slug, id(6), score(5));
    const found = await participantRatings(test.db, [id(6), id(7), id(6)]);
    const rated = found.get(id(6))!;
    expect(rated).toMatchObject({ count: 3, isNew: false });
    // Pulled toward the site-wide mean by the prior: above it, below the plain average.
    expect(rated.score).toBeGreaterThan(4);
    expect(rated.score).toBeLessThan(14 / 3);
    expect(found.get(id(7))).toEqual({ score: null, count: 0, isNew: true });
  });
});

describe('account', () => {
  it('exports what the GM gave with the note, and what a player got without it', async () => {
    const table = await makeTable({ gmId: otherGm.id }, { 8: true });
    await ratePlayer(test.db, otherGm, table.slug, id(8), score(3, 'Só para mim.'));

    const asGm = await exportAccount(test.db, otherGm.id, 'gm@example.com');
    expect(asGm.playerRatingsGiven).toEqual([
      expect.objectContaining({
        slug: table.slug,
        playerId: id(8),
        score: 3,
        comment: 'Só para mim.',
      }),
    ]);
    const asPlayer = await exportAccount(test.db, id(8), 'p@example.com');
    expect(asPlayer.playerRatingsReceived).toEqual([
      expect.objectContaining({ slug: table.slug, score: 3 }),
    ]);
    expect(asPlayer.playerRatingsReceived[0]).not.toHaveProperty('comment');
  });

  it('closing the account drops their participant score and the notes they wrote as a GM', async () => {
    const table = await makeTable({ gmId: id(4) }, { 5: true });
    const rated = await makeTable({}, { 4: true });
    await ratePlayer(test.db, person(4), table.slug, id(5), score(2, 'Nota.'));
    await ratePlayer(test.db, gm, rated.slug, id(4), score(4));

    await closeAccount(test.db, id(4));

    const [given] = await test.db
      .select()
      .from(playerRatings)
      .where(and(eq(playerRatings.tableId, table.id), eq(playerRatings.playerId, id(5))));
    expect(given).toMatchObject({ score: 2, comment: null });
    expect(
      await test.db
        .select()
        .from(playerRatings)
        .where(eq(playerRatings.playerId, id(4))),
    ).toEqual([]);
  });
});
