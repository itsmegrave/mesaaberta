import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, asc, eq } from 'drizzle-orm';
import {
  events,
  gameTables,
  profiles,
  registrations,
  systems,
  tableSessionAttendance,
  tableSessions,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import { Forbidden, Invalid } from '@mesaaberta/core/server/errors';
import {
  cancelSession,
  moveSession,
  noteSession,
  scheduleSession,
} from '@mesaaberta/core/server/tables/session-actions';
import { listSessions, syncTableSessions } from '@mesaaberta/core/server/tables/sessions';
import { finishTable, holdSession } from '@mesaaberta/core/server/tables/lifecycle';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000052${String(n).padStart(2, '0')}`;
const person = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const gm = person(1);
const ana = person(2);
const stranger = person(3);
// Saturdays at 19:00 in São Paulo (22:00 UTC), from 7 November 2026.
const first = new Date('2026-11-07T22:00:00Z');
const now = new Date('2026-11-01T12:00:00Z');
const week = 7 * 24 * 3_600_000;
let counter = 0;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm.id, username: 'mestra-agenda' },
    { id: ana.id, username: 'ana-agenda' },
    { id: stranger.id, username: 'outra-agenda' },
  ]);
});
afterAll(() => test.close());
beforeEach(() => test.db.delete(events));

const scheduled = async (tableId: string) =>
  test.db
    .select({
      id: tableSessions.id,
      startsAt: tableSessions.startsAt,
      pinned: tableSessions.pinned,
      movedFrom: tableSessions.movedFrom,
      note: tableSessions.note,
    })
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, 'scheduled')))
    .orderBy(asc(tableSessions.startsAt));
const tableAt = async (tableId: string) =>
  (await test.db.select().from(gameTables).where(eq(gameTables.id, tableId)))[0];
const lastEvent = async () =>
  (await test.db.select().from(events).orderBy(asc(events.createdAt))).at(-1)!;
const times = (rows: { startsAt: Date }[]) => rows.map(({ startsAt }) => startsAt.getTime());

/** An active weekly campaign with Ana seated, its dates written out as the app keeps them. */
async function campaign(over: Partial<typeof gameTables.$inferInsert> = {}) {
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const slug = `agenda-${++counter}`;
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: slug,
      kind: 'campaign',
      recurrence: 'FREQ=WEEKLY',
      capacity: 5,
      startsAt: first,
      durationMinutes: 180,
      timezone: 'America/Sao_Paulo',
      gmId: gm.id,
      systemId: system.id,
      status: 'active',
      ...over,
    })
    .returning();
  await test.db
    .insert(registrations)
    .values({ tableId: table.id, playerId: ana.id, status: 'confirmed' });
  await syncTableSessions(test.db, [table.id]);
  return table;
}

describe('a weekly table keeps its next dates', () => {
  it('writes out four dates from the rule', async () => {
    const table = await campaign();
    expect(times(await scheduled(table.id))).toEqual([0, 1, 2, 3].map((n) => +first + n * week));
  });

  it('an adventure without a rule, a one-shot and a draft keep their one date', async () => {
    for (const over of [
      { kind: 'adventure' as const, recurrence: null, plannedSessions: 4 },
      { kind: 'one_shot' as const, recurrence: null },
      { status: 'draft' as const },
    ]) {
      const table = await campaign(over);
      expect(times(await scheduled(table.id))).toEqual([+first]);
    }
  });

  it('stops at the rule’s end date', async () => {
    const table = await campaign({ until: new Date(+first + week + 1) });
    expect(times(await scheduled(table.id))).toEqual([+first, +first + week]);
  });

  it('a new time rewrites the dates nobody moved, and keeps the one quem mestra moved', async () => {
    const table = await campaign();
    const [, second] = await scheduled(table.id);
    await moveSession(
      test.db,
      gm,
      table.slug,
      { sessionId: second.id, startsAtLocal: '2026-11-15T15:00' },
      now,
    );

    const later = new Date(+first + 3_600_000);
    await test.db.update(gameTables).set({ startsAt: later }).where(eq(gameTables.id, table.id));
    await syncTableSessions(test.db, [table.id], { reflow: true });

    const rows = await scheduled(table.id);
    expect(times(rows)).toEqual([
      +later,
      +new Date('2026-11-15T18:00:00Z'),
      +later + 2 * week,
      +later + 3 * week,
    ]);
    expect(rows[1].pinned).toBe(true);
  });
});

describe('quem mestra manages the sessions', () => {
  it('schedules one more session, which the players hear of', async () => {
    const table = await campaign({ recurrence: null, kind: 'adventure', plannedSessions: 5 });

    await scheduleSession(
      test.db,
      gm,
      table.slug,
      { startsAtLocal: '2026-11-20T20:00', note: '  Tragam as fichas.  ' },
      now,
    );

    const rows = await scheduled(table.id);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ pinned: true, note: 'Tragam as fichas.' });
    expect(await lastEvent()).toMatchObject({
      type: 'SessionScheduled',
      actorId: gm.id,
      payload: expect.objectContaining({ sessionId: rows[1].id, slug: table.slug }),
    });
    expect((await tableAt(table.id)).startsAt).toEqual(first);
  });

  it('a session earlier than the next one moves the table, as a change of date', async () => {
    const table = await campaign();

    await scheduleSession(test.db, gm, table.slug, { startsAtLocal: '2026-11-04T19:00' }, now);

    const moved = await tableAt(table.id);
    expect(moved.startsAt).toEqual(new Date('2026-11-04T22:00:00Z'));
    expect(moved.icalSequence).toBe(table.icalSequence + 1);
    expect(await lastEvent()).toMatchObject({
      type: 'TableUpdated',
      payload: expect.objectContaining({
        changes: expect.objectContaining({ startsAt: expect.anything() }),
      }),
    });
  });

  it('refuses a date in the past, a date already taken and an adventure past its plan', async () => {
    const table = await campaign();
    await expect(
      scheduleSession(test.db, gm, table.slug, { startsAtLocal: '2026-10-01T19:00' }, now),
    ).rejects.toMatchObject({ field: 'startsAtLocal', message: 'in_the_past' });
    await expect(
      scheduleSession(test.db, gm, table.slug, { startsAtLocal: '2026-11-14T19:00' }, now),
    ).rejects.toMatchObject({ field: 'startsAtLocal', message: 'session_taken' });

    const adventure = await campaign({ kind: 'adventure', recurrence: null, plannedSessions: 2 });
    await scheduleSession(test.db, gm, adventure.slug, { startsAtLocal: '2026-11-20T20:00' }, now);
    await expect(
      scheduleSession(test.db, gm, adventure.slug, { startsAtLocal: '2026-11-27T20:00' }, now),
    ).rejects.toBeInstanceOf(Invalid);
  });

  it('only quem mestra (or an admin) manages them, and not on a one-shot', async () => {
    const table = await campaign();
    await expect(
      scheduleSession(test.db, stranger, table.slug, { startsAtLocal: '2026-11-20T20:00' }, now),
    ).rejects.toBeInstanceOf(Forbidden);
    const oneShot = await campaign({ kind: 'one_shot', recurrence: null });
    await expect(
      scheduleSession(test.db, gm, oneShot.slug, { startsAtLocal: '2026-11-20T20:00' }, now),
    ).rejects.toBeInstanceOf(Forbidden);
  });

  it('moves a later session without touching the others, and the rule does not bring it back', async () => {
    const table = await campaign();
    const [, , third] = await scheduled(table.id);

    await moveSession(
      test.db,
      gm,
      table.slug,
      { sessionId: third.id, startsAtLocal: '2026-11-22T19:00' },
      now,
    );

    const rows = await scheduled(table.id);
    const moved = rows.find((row) => row.id === third.id)!;
    expect(moved).toMatchObject({ pinned: true, movedFrom: third.startsAt });
    expect(times(rows)).not.toContain(+third.startsAt);
    expect(rows).toHaveLength(4);
    expect(await lastEvent()).toMatchObject({
      type: 'SessionMoved',
      payload: expect.objectContaining({ from: third.startsAt.toISOString() }),
    });
    const after = await tableAt(table.id);
    expect(after.startsAt).toEqual(first);
    // The calendar event changed: invites carry a higher sequence so calendars take the new copy.
    expect(after.icalSequence).toBe(table.icalSequence + 1);
  });

  it('writes and clears a note without telling anyone', async () => {
    const table = await campaign();
    const [next] = await scheduled(table.id);

    expect(
      await noteSession(test.db, gm, table.slug, { sessionId: next.id, note: 'Começa às 20h.' }),
    ).toEqual({ eventId: null });
    expect((await scheduled(table.id))[0].note).toBe('Começa às 20h.');
    await noteSession(test.db, gm, table.slug, { sessionId: next.id, note: '   ' });
    expect((await scheduled(table.id))[0].note).toBeNull();
    expect(await test.db.select().from(events)).toEqual([]);
  });

  it('cancels a later session with a message, and the rule writes the next date after the last', async () => {
    const table = await campaign();
    const [, second] = await scheduled(table.id);

    await cancelSession(
      test.db,
      gm,
      table.slug,
      { sessionId: second.id, message: 'Viagem de trabalho.' },
      now,
    );

    const [row] = await test.db.select().from(tableSessions).where(eq(tableSessions.id, second.id));
    expect(row).toMatchObject({ status: 'cancelled', note: 'Viagem de trabalho.' });
    expect(times(await scheduled(table.id))).toEqual([0, 2, 3, 4].map((n) => +first + n * week));
    expect((await lastEvent()).type).toBe('SessionCancelled');
  });

  it('cancelling the next session moves the table to the one after it', async () => {
    const table = await campaign();
    const [next] = await scheduled(table.id);

    await cancelSession(test.db, gm, table.slug, { sessionId: next.id }, now);

    expect((await tableAt(table.id)).startsAt).toEqual(new Date(+first + week));
    expect((await lastEvent()).type).toBe('TableUpdated');
  });

  it('will not cancel the only session left', async () => {
    const table = await campaign({ kind: 'adventure', recurrence: null, plannedSessions: 3 });
    const [only] = await scheduled(table.id);
    await expect(
      cancelSession(test.db, gm, table.slug, { sessionId: only.id }, now),
    ).rejects.toMatchObject({ message: 'only_session' });
  });
});

describe('after a session', () => {
  it('"A mesa continua?" without a date takes the next session on the list', async () => {
    const table = await campaign();
    const [, second] = await scheduled(table.id);
    await moveSession(
      test.db,
      gm,
      table.slug,
      { sessionId: second.id, startsAtLocal: '2026-11-15T15:00' },
      now,
    );
    await test.db
      .update(gameTables)
      .set({ status: 'awaiting_confirmation' })
      .where(eq(gameTables.id, table.id));

    await holdSession(test.db, gm, table.slug, {}, new Date('2026-11-08T12:00:00Z'));

    expect((await tableAt(table.id)).startsAt).toEqual(new Date('2026-11-15T18:00:00Z'));
    const rows = await scheduled(table.id);
    expect(rows[0].id).toBe(second.id);
    expect(rows).toHaveLength(4);
  });

  it('ending the table cancels the next session and drops the dates the rule wrote', async () => {
    const table = await campaign();
    const [, second] = await scheduled(table.id);
    await moveSession(
      test.db,
      gm,
      table.slug,
      { sessionId: second.id, startsAtLocal: '2026-11-15T15:00' },
      now,
    );

    await finishTable(test.db, gm, table.slug);

    const rows = await test.db
      .select({ status: tableSessions.status, pinned: tableSessions.pinned })
      .from(tableSessions)
      .where(eq(tableSessions.tableId, table.id))
      .orderBy(asc(tableSessions.startsAt));
    expect(rows).toEqual([
      { status: 'cancelled', pinned: false },
      { status: 'cancelled', pinned: true },
    ]);
  });
});

describe('the sessions as each person sees them', () => {
  it('numbers them from the first, sessions held before tracking included', async () => {
    const table = await campaign({ status: 'awaiting_confirmation' });
    // Two sessions held before sessions were tracked.
    await test.db.insert(events).values(
      [1, 2].map(() => ({
        type: 'TableSessionHeld',
        actorId: gm.id,
        payload: { tableId: table.id, slug: table.slug, title: table.title, nextStartsAt: '' },
      })),
    );
    await holdSession(
      test.db,
      gm,
      table.slug,
      { presentPlayerIds: [ana.id] },
      new Date('2026-11-08T12:00:00Z'),
    );
    const [held] = await test.db
      .select({ id: tableSessions.id })
      .from(tableSessions)
      .where(and(eq(tableSessions.tableId, table.id), eq(tableSessions.status, 'held')));
    await test.db
      .update(tableSessions)
      .set({ note: 'Só para a mesa.' })
      .where(eq(tableSessions.tableId, table.id));
    const status = (await tableAt(table.id)).status;

    const gmView = await listSessions(test.db, { id: table.id, status }, { role: 'gm' });
    // The two before tracking and the one just held (its own `TableSessionHeld` too).
    expect(gmView.map(({ number }) => number)).toEqual([3, 4, 5, 6, 7]);
    expect(gmView[0]).toMatchObject({
      id: held.id,
      status: 'held',
      present: { count: 1, of: 1 },
      attended: null,
    });

    const player = await listSessions(
      test.db,
      { id: table.id, status },
      { role: 'player', playerId: ana.id },
    );
    expect(player[0]).toMatchObject({ present: null, attended: true, note: 'Só para a mesa.' });

    const visitor = await listSessions(test.db, { id: table.id, status }, { role: 'visitor' });
    expect(visitor[0]).toMatchObject({ present: null, attended: null, note: null });
    expect(
      await test.db
        .select()
        .from(tableSessionAttendance)
        .where(eq(tableSessionAttendance.sessionId, held.id)),
    ).toHaveLength(1);
  });
});
