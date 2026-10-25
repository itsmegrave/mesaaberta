import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  gameTables,
  notifications,
  profiles,
  registrations,
  systems,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import {
  reminderId,
  reminderWindow,
  sendSessionReminders,
} from '@mesaaberta/core/server/notifications/reminders';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000031${String(n).padStart(2, '0')}`;
const now = new Date('2026-10-01T12:00:00Z');
const hours = (n: number) => new Date(now.getTime() + n * 3600 * 1000);
let counter = 0;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: id(1), username: 'mestra' },
    { id: id(2), username: 'jogadora' },
    { id: id(3), username: 'pedinte' },
    { id: id(4), username: 'atrasada' },
  ]);
});
afterAll(() => test.close());

const makeTable = async (over: Partial<typeof gameTables.$inferInsert> = {}) => {
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const slug = `lembrete-${++counter}`;
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: slug,
      kind: 'one_shot',
      capacity: 5,
      startsAt: hours(20),
      durationMinutes: 180,
      timezone: 'America/Sao_Paulo',
      gmId: id(1),
      systemId: system.id,
      ...over,
    })
    .returning();
  await test.db.insert(registrations).values([
    { tableId: table.id, playerId: id(2), status: 'confirmed' },
    { tableId: table.id, playerId: id(3), status: 'pending' },
  ]);
  return table;
};

const remindersOf = async (tableId: string) =>
  (await test.db.select().from(notifications).where(eq(notifications.type, 'session_reminder')))
    .filter((row) => (row.metadata as { tableId?: string }).tableId === tableId)
    .sort((a, b) => a.recipientId.localeCompare(b.recipientId));

describe('reminderWindow', () => {
  it('is the hour reminder in the last hour, the day one before that, none outside a day', () => {
    expect(reminderWindow(hours(25), now)).toBeNull();
    expect(reminderWindow(hours(24), now)).toBe('24h');
    expect(reminderWindow(hours(1.5), now)).toBe('24h');
    expect(reminderWindow(hours(1), now)).toBe('1h');
    expect(reminderWindow(now, now)).toBeNull();
  });
});

describe('reminderId', () => {
  it('is a stable UUID for one table, start and window', async () => {
    const a = await reminderId(id(9), hours(5), '24h');
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await reminderId(id(9), hours(5), '24h')).toBe(a);
    expect(await reminderId(id(9), hours(5), '1h')).not.toBe(a);
    expect(await reminderId(id(9), hours(6), '24h')).not.toBe(a);
  });
});

describe('sendSessionReminders', () => {
  it('reminds the GM and the confirmed players once a day before and once an hour before', async () => {
    const table = await makeTable();

    await sendSessionReminders(test.db, now);
    await sendSessionReminders(test.db, hours(1));
    const day = await remindersOf(table.id);
    expect(day.map((row) => row.recipientId)).toEqual([id(1), id(2)]);
    expect(day[0]).toMatchObject({
      category: 'table',
      link: `/t/${table.slug}`,
      metadata: {
        tableId: table.id,
        slug: table.slug,
        title: table.title,
        startsAt: hours(20).toISOString(),
        window: '24h',
      },
    });

    await sendSessionReminders(test.db, hours(19.5));
    await sendSessionReminders(test.db, hours(19.6));
    const all = await remindersOf(table.id);
    expect(all).toHaveLength(4);
    expect(all.filter((row) => (row.metadata as { window: string }).window === '1h')).toHaveLength(
      2,
    );
  });

  it('catches up a player confirmed after the reminder went out', async () => {
    const table = await makeTable();
    await sendSessionReminders(test.db, now);
    await test.db
      .insert(registrations)
      .values({ tableId: table.id, playerId: id(4), status: 'confirmed' });

    await sendSessionReminders(test.db, hours(0.1));
    expect((await remindersOf(table.id)).map((row) => row.recipientId)).toEqual([
      id(1),
      id(2),
      id(4),
    ]);
  });

  it('sends a moved session its own reminders', async () => {
    const table = await makeTable();
    await sendSessionReminders(test.db, now);
    await test.db
      .update(gameTables)
      .set({ startsAt: hours(22) })
      .where(eq(gameTables.id, table.id));

    await sendSessionReminders(test.db, now);
    expect(await remindersOf(table.id)).toHaveLength(4);
  });

  it('leaves out tables that are not open or start more than a day ahead', async () => {
    const cancelled = await makeTable({ status: 'disabled' });
    const draft = await makeTable({ status: 'draft' });
    const later = await makeTable({ startsAt: hours(30) });
    const past = await makeTable({ startsAt: hours(-1) });

    await sendSessionReminders(test.db, now);
    for (const table of [cancelled, draft, later, past])
      expect(await remindersOf(table.id)).toEqual([]);
  });
});
