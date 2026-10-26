import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { SupabaseAdmin } from '@mesaaberta/core/server/auth/admin-client';
import {
  events,
  gameTables,
  mailDeliveries,
  profiles,
  ratings,
  registrations,
  sessionCloseReminders,
  systems,
} from '@mesaaberta/core/server/db/schema';
import type { Mail } from '@mesaaberta/core/server/mail/mailer';
import type { StoredEvent } from '@mesaaberta/core/server/events/types';
import { createCloseReminderMailHandler } from '@mesaaberta/core/server/events/close-reminder-mail';
import { closeStepFor, remindToClose } from '@mesaaberta/core/server/tables/close-reminders';
import { createTestDb } from '../db/test-db';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000041${String(n).padStart(2, '0')}`;
const gmId = id(1);
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const now = new Date('2026-10-20T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const everyone = async () => true;
let counter = 0;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: id(1), username: 'mestra', name: 'Mestra' },
    { id: id(2), username: 'ana', name: 'Ana' },
    { id: id(3), username: 'bia' },
    { id: id(4), username: 'caio' },
  ]);
});
afterAll(() => test.close());

/** A table awaiting confirmation whose three-hour session ended `endedAgo` before `now`. */
const awaiting = async (endedAgo: number, over: Partial<typeof gameTables.$inferInsert> = {}) => {
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const slug = `fechar-${++counter}`;
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: slug,
      kind: 'one_shot',
      capacity: 5,
      startsAt: ago(endedAgo + 3 * HOUR),
      durationMinutes: 180,
      timezone: 'America/Sao_Paulo',
      gmId,
      systemId: system.id,
      status: 'awaiting_confirmation',
      ...over,
    })
    .returning();
  return table;
};

const eventsOf = async (tableId: string) =>
  (await test.db.select().from(events)).filter(
    (event) => (event.payload as { tableId?: string }).tableId === tableId,
  );
const statusOf = async (tableId: string) =>
  (await test.db.select().from(gameTables).where(eq(gameTables.id, tableId)))[0].status;

describe('closeStepFor', () => {
  const ended = ago(0);
  const at = (ms: number) => new Date(ended.getTime() + ms);

  it('waits an hour after the session before the first reminder', () => {
    expect(closeStepFor(ended, at(59 * 60 * 1000), {})).toBeNull();
    expect(closeStepFor(ended, at(HOUR), {})).toBe('1h');
    expect(closeStepFor(ended, at(6 * DAY), { '1h': at(HOUR) })).toBeNull();
  });

  it('sends the last reminder a week after, skipping the first when it is that late', () => {
    expect(closeStepFor(ended, at(7 * DAY), { '1h': at(HOUR) })).toBe('7d');
    expect(closeStepFor(ended, at(30 * DAY), {})).toBe('7d');
  });

  it('closes ten days after the session, never sooner than three days after the last reminder', () => {
    expect(closeStepFor(ended, at(10 * DAY), { '7d': at(7 * DAY) })).toBe('close');
    expect(closeStepFor(ended, at(10 * DAY - 1), { '7d': at(7 * DAY) })).toBeNull();
    // A table that waited from before the reminders existed gets its warning first.
    expect(closeStepFor(ended, at(40 * DAY), { '7d': at(39 * DAY) })).toBeNull();
    expect(closeStepFor(ended, at(42 * DAY), { '7d': at(39 * DAY) })).toBe('close');
  });
});

describe('remindToClose', () => {
  it('leaves a session that ended less than an hour ago alone', async () => {
    const table = await awaiting(30 * 60 * 1000);
    await remindToClose(test.db, now, everyone);
    expect(await eventsOf(table.id)).toEqual([]);
  });

  it('records the first reminder once, however many sweeps run', async () => {
    const table = await awaiting(2 * HOUR);

    const first = await remindToClose(test.db, now, everyone);
    await remindToClose(test.db, new Date(now.getTime() + 5 * 60 * 1000), everyone);

    expect(first.reminded).toHaveLength(1);
    expect(await eventsOf(table.id)).toEqual([
      expect.objectContaining({
        type: 'TableCloseReminder',
        actorId: null,
        payload: expect.objectContaining({ tableId: table.id, step: '1h' }),
      }),
    ]);
  });

  it('only for the GMs the flag is on for, read with their id and role', async () => {
    const table = await awaiting(2 * HOUR);
    const enabled = vi.fn(async () => false);

    await remindToClose(test.db, now, enabled);

    expect(enabled).toHaveBeenCalledWith({ id: gmId, isAdmin: false });
    expect(await eventsOf(table.id)).toEqual([]);
  });

  it('ignores tables that are not waiting on their GM', async () => {
    const active = await awaiting(2 * HOUR, { status: 'active' });
    const concluded = await awaiting(2 * HOUR, { status: 'concluded' });
    await remindToClose(test.db, now, everyone);
    expect(await eventsOf(active.id)).toEqual([]);
    expect(await eventsOf(concluded.id)).toEqual([]);
  });

  it('starts over for a session moved to another date', async () => {
    const table = await awaiting(2 * HOUR);
    await remindToClose(test.db, now, everyone);
    // The GM postponed it, and the new date also went by unanswered.
    await test.db
      .update(gameTables)
      .set({ startsAt: new Date(now.getTime() + DAY) })
      .where(eq(gameTables.id, table.id));
    await remindToClose(test.db, new Date(now.getTime() + DAY + 5 * HOUR), everyone);
    expect((await eventsOf(table.id)).map((event) => event.type)).toEqual([
      'TableCloseReminder',
      'TableCloseReminder',
    ]);
  });

  it('concludes a table nobody answered for, three days after the last reminder', async () => {
    const table = await awaiting(8 * DAY);
    await remindToClose(test.db, now, everyone);
    const early = await remindToClose(test.db, new Date(now.getTime() + 2 * DAY), everyone);
    expect(early.closed).toEqual([]);

    const late = await remindToClose(test.db, new Date(now.getTime() + 3 * DAY), everyone);

    expect(late.closed).toHaveLength(1);
    expect(await statusOf(table.id)).toBe('concluded');
    expect((await eventsOf(table.id)).at(-1)).toMatchObject({
      type: 'TableConcluded',
      actorId: null,
      payload: { tableId: table.id, autoClosed: true },
    });
  });

  /** A multi-session table whose 7d reminder went out four days ago, eleven days after its session. */
  const overdue = async (over: Partial<typeof gameTables.$inferInsert>) => {
    const table = await awaiting(11 * DAY, over);
    await test.db.insert(sessionCloseReminders).values({
      tableId: table.id,
      startsAt: table.startsAt,
      step: '7d',
      sentAt: ago(4 * DAY),
    });
    return table;
  };

  it('keeps a campaign going: the session counts as held, the next weekly date, ratings open', async () => {
    const table = await overdue({ kind: 'campaign', recurrence: 'FREQ=WEEKLY;INTERVAL=2' });
    await test.db.insert(registrations).values([
      { tableId: table.id, playerId: id(2), status: 'confirmed' },
      { tableId: table.id, playerId: id(3), status: 'confirmed', attended: false },
    ]);

    await remindToClose(test.db, now, everyone);

    const [after] = await test.db.select().from(gameTables).where(eq(gameTables.id, table.id));
    expect(after.status).toBe('active');
    // Every two weeks from the session that went unanswered: the first such date after now.
    expect(after.startsAt).toEqual(new Date(table.startsAt.getTime() + 14 * DAY));
    expect(after.icalSequence).toBe(table.icalSequence + 1);
    const opened = await test.db
      .select({ id: registrations.playerId, at: registrations.ratingOpenedAt })
      .from(registrations)
      .where(eq(registrations.tableId, table.id));
    expect(opened.find((row) => row.id === id(2))?.at).toEqual(now);
    expect(opened.find((row) => row.id === id(3))?.at).toBeNull();
    expect((await eventsOf(table.id)).map((event) => [event.type, event.payload])).toEqual([
      [
        'TableSessionHeld',
        expect.objectContaining({ nextStartsAt: after.startsAt.toISOString(), autoClosed: true }),
      ],
      ['RatingsOpened', expect.objectContaining({ playerIds: [id(2)], autoClosed: true })],
    ]);
  });

  it('moves an adventure, which has no repeat, a week on', async () => {
    const table = await overdue({ kind: 'adventure' });
    await remindToClose(test.db, now, everyone);
    const [after] = await test.db.select().from(gameTables).where(eq(gameTables.id, table.id));
    expect(after.status).toBe('active');
    expect(after.startsAt).toEqual(new Date(table.startsAt.getTime() + 14 * DAY));
  });

  it('never closes a table the GM answered meanwhile', async () => {
    const table = await awaiting(11 * DAY);
    await test.db.insert(sessionCloseReminders).values({
      tableId: table.id,
      startsAt: table.startsAt,
      step: '7d',
      sentAt: ago(4 * DAY),
    });
    await test.db.update(gameTables).set({ status: 'not_held' }).where(eq(gameTables.id, table.id));

    await remindToClose(test.db, now, everyone);

    expect(await statusOf(table.id)).toBe('not_held');
  });
});

describe('the close reminder e-mails', () => {
  const config = {
    RESEND_FROM: 'Mesa Aberta <ola@mesaaberta.app>',
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_x',
    APP_ORIGIN: 'https://mesaaberta.app',
  };
  const admin: SupabaseAdmin = {
    auth: {
      admin: {
        getUserById: vi.fn(async (userId: string) => ({
          data: { user: { email: `${userId}@example.com` } },
          error: null,
        })),
        deleteUser: vi.fn(),
      },
    },
  };
  let sent: Mail[];
  const handler = () =>
    createCloseReminderMailHandler(config, fetch, admin, {
      send: async (mail) => void sent.push(mail),
    });
  const stored = (type: StoredEvent['type'], payload: object): StoredEvent =>
    ({
      id: crypto.randomUUID(),
      type,
      payload,
      actorId: null,
      createdAt: now,
      attempts: 0,
    }) as StoredEvent;

  beforeEach(async () => {
    sent = [];
    await test.db.delete(mailDeliveries);
  });

  it('asks the GM whether the session happened, with the link to answer', async () => {
    const table = await awaiting(2 * HOUR);
    await handler().handle(
      stored('TableCloseReminder', { ...table, tableId: table.id, step: '1h' }),
      test.db,
    );
    expect(sent).toEqual([
      expect.objectContaining({
        to: `${gmId}@example.com`,
        subject: expect.stringContaining(table.title),
        text: expect.stringContaining(`https://mesaaberta.app/t/${table.slug}/manage`),
      }),
    ]);
    expect(sent[0].text).not.toContain('marcada como concluída');
  });

  it('says in the last reminder when the table will be concluded', async () => {
    const table = await awaiting(7 * DAY);
    await handler().handle(
      stored('TableCloseReminder', { ...table, tableId: table.id, step: '7d' }),
      test.db,
    );
    // Ended 2026-10-13 12:00Z: concluded ten days later, 09:00 in São Paulo.
    expect(sent[0].text).toMatch(/até sexta-feira, 23 de outubro.*09:00.*marcada como concluída/s);
  });

  it('sends nothing once the GM answered', async () => {
    const table = await awaiting(2 * HOUR, { status: 'concluded' });
    await handler().handle(
      stored('TableCloseReminder', { ...table, tableId: table.id, step: '1h' }),
      test.db,
    );
    expect(sent).toEqual([]);
  });

  it('asks every confirmed player who has not rated a table concluded for its GM, once', async () => {
    const table = await awaiting(10 * DAY, { status: 'concluded' });
    await test.db.insert(registrations).values([
      { tableId: table.id, playerId: id(2), status: 'confirmed' },
      { tableId: table.id, playerId: id(3), status: 'confirmed' },
      { tableId: table.id, playerId: id(4), status: 'pending' },
    ]);
    await test.db.insert(ratings).values({ tableId: table.id, playerId: id(3), gmScore: 5 });
    const event = stored('TableConcluded', {
      tableId: table.id,
      slug: table.slug,
      title: table.title,
      autoClosed: true,
    });

    await handler().handle(event, test.db);
    await handler().handle(event, test.db);

    expect(sent).toEqual([
      expect.objectContaining({
        to: `${id(2)}@example.com`,
        text: expect.stringContaining(`https://mesaaberta.app/t/${table.slug}`),
      }),
    ]);
  });

  it('asks the players let rate a session held for its GM, saying the table goes on', async () => {
    const table = await awaiting(2 * HOUR, { status: 'active', kind: 'adventure' });
    await test.db.insert(registrations).values([
      { tableId: table.id, playerId: id(2), status: 'confirmed' },
      { tableId: table.id, playerId: id(3), status: 'confirmed', attended: false },
    ]);
    await handler().handle(
      stored('RatingsOpened', {
        tableId: table.id,
        slug: table.slug,
        title: table.title,
        playerIds: [id(2)],
        autoClosed: true,
      }),
      test.db,
    );
    expect(sent).toEqual([
      expect.objectContaining({
        to: `${id(2)}@example.com`,
        text: expect.stringContaining('última sessão'),
      }),
    ]);
  });

  it('leaves a table its GM concluded to the bell', async () => {
    const table = await awaiting(2 * HOUR, { status: 'concluded' });
    await test.db
      .insert(registrations)
      .values({ tableId: table.id, playerId: id(2), status: 'confirmed' });
    await handler().handle(
      stored('TableConcluded', { tableId: table.id, slug: table.slug, title: table.title }),
      test.db,
    );
    expect(sent).toEqual([]);
  });
});
