import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { events, gameTables, profiles, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import type { Actor } from '../auth/policy';
import { findTableBySlug, listUpcomingTables } from './queries';
import {
  closeElapsedTables,
  concludeTable,
  markTableNotHeld,
  postponeTable,
  sessionEndedBy,
} from './lifecycle';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000030${String(n).padStart(2, '0')}`;
const person = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const gm = person(1);
const stranger = person(2);
const now = new Date('2026-10-01T12:00:00Z');
let counter = 0;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: id(1), username: 'mestra' },
    { id: id(2), username: 'curiosa' },
  ]);
});
afterAll(() => test.close());

const makeTable = async (over: Partial<typeof gameTables.$inferInsert> = {}) => {
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const slug = `ciclo-${++counter}`;
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: slug,
      kind: 'one_shot',
      capacity: 5,
      // Ended at 11:00Z today.
      startsAt: new Date('2026-10-01T08:00:00Z'),
      durationMinutes: 180,
      timezone: 'America/Sao_Paulo',
      gmId: gm.id,
      systemId: system.id,
      ...over,
    })
    .returning();
  return table;
};

const statusOf = async (slug: string) =>
  (await test.db.select().from(gameTables).where(eq(gameTables.slug, slug)))[0].status;
const eventsOf = async (tableId: string) =>
  (await test.db.select().from(events)).filter(
    (event) => (event.payload as { tableId?: string }).tableId === tableId,
  );

describe('closeElapsedTables', () => {
  it('moves a table whose session is over to awaiting confirmation and records one event', async () => {
    const table = await makeTable();

    const ids = await closeElapsedTables(test.db, now);

    expect(ids).toHaveLength(1);
    expect(await statusOf(table.slug)).toBe('awaiting_confirmation');
    expect(await eventsOf(table.id)).toEqual([
      expect.objectContaining({ type: 'TableAwaitingConfirmation', actorId: null }),
    ]);
  });

  it('waits for the end of the session, not its start', async () => {
    // Started at 11:00Z, runs three hours: still on at 12:00Z.
    const running = await makeTable({
      startsAt: new Date('2026-10-01T11:00:00Z'),
      durationMinutes: 180,
    });
    const upcoming = await makeTable({ startsAt: new Date('2026-10-20T20:00:00Z') });

    await closeElapsedTables(test.db, now);

    expect(await statusOf(running.slug)).toBe('active');
    expect(await statusOf(upcoming.slug)).toBe('active');
  });

  it('is repeatable: a table is asked about once, and a table the GM disabled is left alone', async () => {
    const table = await makeTable();
    const disabled = await makeTable({ status: 'disabled' });

    await closeElapsedTables(test.db, now);
    await closeElapsedTables(test.db, now);

    expect(await eventsOf(table.id)).toHaveLength(1);
    expect(await statusOf(disabled.slug)).toBe('disabled');
    expect(await eventsOf(disabled.id)).toHaveLength(0);
  });

  it('counts a campaign by its first date: recurrence is not managed', async () => {
    const campaign = await makeTable({
      kind: 'campaign',
      recurrence: 'FREQ=WEEKLY',
      startsAt: new Date('2026-09-01T20:00:00Z'),
    });

    await closeElapsedTables(test.db, now);

    expect(await statusOf(campaign.slug)).toBe('awaiting_confirmation');
  });

  it('takes the table out of the search but not off its own page', async () => {
    const table = await makeTable({
      title: 'Some da busca',
      startsAt: new Date('2026-10-01T08:00:00Z'),
    });
    const before = await listUpcomingTables(test.db, new Date('2026-10-01T07:00:00Z'));
    expect(before.map((t) => t.slug)).toContain(table.slug);

    await closeElapsedTables(test.db, now);

    expect((await listUpcomingTables(test.db, now)).map((t) => t.slug)).not.toContain(table.slug);
    expect(await findTableBySlug(test.db, table.slug, now)).toMatchObject({
      slug: table.slug,
      status: 'awaiting_confirmation',
    });
  });
});

describe('answering', () => {
  const waiting = () => makeTable({ status: 'awaiting_confirmation' });

  it('concludes the table when the GM says it happened, and records the event', async () => {
    const table = await waiting();

    const { eventId } = await concludeTable(test.db, gm, table.slug);

    expect(await statusOf(table.slug)).toBe('concluded');
    expect(await eventsOf(table.id)).toEqual([
      expect.objectContaining({ id: eventId, type: 'TableConcluded', actorId: gm.id }),
    ]);
  });

  it('marks the table not held when the GM says it did not happen, which is not a cancellation', async () => {
    const table = await waiting();

    await markTableNotHeld(test.db, gm, table.slug);

    expect(await statusOf(table.slug)).toBe('not_held');
    expect(await eventsOf(table.id)).toEqual([expect.objectContaining({ type: 'TableNotHeld' })]);
  });

  it.each([
    ['conclude', concludeTable],
    ['mark not held', markTableNotHeld],
  ])('refuses to %s for someone who is not the GM, and changes nothing', async (_name, act) => {
    const table = await waiting();

    await expect(act(test.db, stranger, table.slug)).rejects.toMatchObject({ name: 'Forbidden' });
    await expect(act(test.db, null, table.slug)).rejects.toMatchObject({ name: 'Forbidden' });

    expect(await statusOf(table.slug)).toBe('awaiting_confirmation');
  });

  it.each(['active', 'concluded', 'not_held', 'disabled'] as const)(
    'refuses an answer for a table that is %s: it is only asked once the date has passed',
    async (status) => {
      const table = await makeTable({ status });

      await expect(concludeTable(test.db, gm, table.slug)).rejects.toMatchObject({
        name: 'Forbidden',
      });
      expect(await statusOf(table.slug)).toBe(status);
    },
  );

  it('lets only one of two answers at once win', async () => {
    const table = await waiting();

    const results = await Promise.allSettled([
      concludeTable(test.db, gm, table.slug),
      markTableNotHeld(test.db, gm, table.slug),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await eventsOf(table.id)).toHaveLength(1);
  });

  it('says not found for a table that is not there', async () => {
    await expect(concludeTable(test.db, gm, 'nao-existe')).rejects.toMatchObject({
      name: 'NotFound',
    });
  });
});

describe('postponeTable', () => {
  it('opens the table again on the new date, read in its own zone, and bumps the calendar sequence', async () => {
    const table = await makeTable({ status: 'awaiting_confirmation', icalSequence: 2 });

    await postponeTable(test.db, gm, table.slug, '2026-10-10T19:00', now);

    const row = (await test.db.select().from(gameTables).where(eq(gameTables.id, table.id)))[0];
    expect(row).toMatchObject({
      status: 'active',
      startsAt: new Date('2026-10-10T22:00:00Z'),
      icalSequence: 3,
    });
    expect(await eventsOf(table.id)).toEqual([expect.objectContaining({ type: 'TableUpdated' })]);
  });

  it('brings the table back to the search until the new date', async () => {
    const table = await makeTable({ status: 'awaiting_confirmation' });

    await postponeTable(test.db, gm, table.slug, '2026-10-10T19:00', now);

    expect((await listUpcomingTables(test.db, now)).map((t) => t.slug)).toContain(table.slug);
  });

  it('refuses a date that is not in the future, and leaves the table waiting', async () => {
    const table = await makeTable({ status: 'awaiting_confirmation' });

    await expect(
      postponeTable(test.db, gm, table.slug, '2026-09-30T19:00', now),
    ).rejects.toMatchObject({ name: 'Invalid', field: 'startsAtLocal' });
    expect(await statusOf(table.slug)).toBe('awaiting_confirmation');
  });

  it('refuses someone who is not the GM, and a table that is not waiting', async () => {
    const waiting = await makeTable({ status: 'awaiting_confirmation' });
    const open = await makeTable();

    await expect(
      postponeTable(test.db, stranger, waiting.slug, '2026-10-10T19:00', now),
    ).rejects.toMatchObject({ name: 'Forbidden' });
    await expect(
      postponeTable(test.db, gm, open.slug, '2026-10-10T19:00', now),
    ).rejects.toMatchObject({ name: 'Forbidden' });
  });
});

describe('sessionEndedBy', () => {
  // The Worker's postgres.js sends a bound `Date` as is, and throws. PGlite accepts one, so check
  // the parameters themselves.
  it('binds the time as a string, never a Date', () => {
    const { params } = new PgDialect().sqlToQuery(sessionEndedBy(now));

    expect(params).toEqual([now.toISOString()]);
  });
});
