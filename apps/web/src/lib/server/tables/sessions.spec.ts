import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
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
import type { TableInput } from '@mesaaberta/core/tables/schema';
import { createTable, disableTable, updateTable } from '@mesaaberta/core/server/tables/write';
import { closeTable } from '@mesaaberta/core/server/tables/end';
import {
  concludeTable,
  finishTable,
  holdSession,
  markTableNotHeld,
  postponeTable,
  skipSession,
} from '@mesaaberta/core/server/tables/lifecycle';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000051${String(n).padStart(2, '0')}`;
const person = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const gm = person(1);
const ana = person(2);
const bia = person(3);
const now = new Date('2026-10-01T12:00:00Z');
let counter = 0;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm.id, username: 'mestra-sessoes' },
    { id: ana.id, username: 'ana-sessoes' },
    { id: bia.id, username: 'bia-sessoes' },
  ]);
});
afterAll(() => test.close());
// The GM opens many tables across the file: each test starts with a clean rate limit.
beforeEach(() => test.db.delete(events));

const sessionsOf = (tableId: string) =>
  test.db
    .select({
      id: tableSessions.id,
      startsAt: tableSessions.startsAt,
      durationMinutes: tableSessions.durationMinutes,
      status: tableSessions.status,
    })
    .from(tableSessions)
    .where(eq(tableSessions.tableId, tableId))
    .orderBy(asc(tableSessions.startsAt), asc(tableSessions.createdAt));

/**
 * A table whose session ended and waits for its GM, with its scheduled session as the migration
 * leaves it, and Ana and Bia seated.
 */
async function awaitingTable(over: Partial<typeof gameTables.$inferInsert> = {}, seed = true) {
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const slug = `sessoes-${++counter}`;
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: slug,
      kind: 'campaign',
      recurrence: 'FREQ=WEEKLY',
      capacity: 5,
      startsAt: new Date('2026-10-01T08:00:00Z'),
      durationMinutes: 180,
      timezone: 'America/Sao_Paulo',
      gmId: gm.id,
      systemId: system.id,
      status: 'awaiting_confirmation',
      ...over,
    })
    .returning();
  if (seed) {
    await test.db.insert(tableSessions).values({
      tableId: table.id,
      startsAt: table.startsAt,
      durationMinutes: table.durationMinutes,
    });
  }
  await test.db.insert(registrations).values([
    { tableId: table.id, playerId: ana.id, status: 'confirmed' },
    { tableId: table.id, playerId: bia.id, status: 'confirmed' },
  ]);
  return table;
}

const input = (over: Partial<TableInput> = {}): TableInput => ({
  systemSlug: 'daggerheart',
  title: 'Mesa com sessões',
  description: 'Uma noite só.',
  extraInfo: null,
  welcomeMessage: null,
  kind: 'one_shot',
  capacity: 5,
  minPlayers: null,
  plannedSessions: null,
  startsAtLocal: '2099-10-10T19:00',
  timezone: 'America/Sao_Paulo',
  durationMinutes: 240,
  recurrence: null,
  untilLocalDate: null,
  joinMode: 'auto',
  modality: 'online',
  locationArea: null,
  joinDetails: null,
  postalCode: null,
  locationNeighbourhood: null,
  locationCity: null,
  locationState: null,
  platforms: [],
  tags: [],
  removeImage: false,
  ...over,
});
const tableAt = async (slug: string) =>
  (await test.db.select().from(gameTables).where(eq(gameTables.slug, slug)))[0];

describe('table sessions follow the table', () => {
  it('schedules a new table’s session, moves it with an edit and cancels it when closed', async () => {
    const { slug } = await createTable(test.db, gm, input({ title: 'Sessão nova' }), { now });
    const table = await tableAt(slug);
    expect(await sessionsOf(table.id)).toEqual([
      expect.objectContaining({
        startsAt: table.startsAt,
        durationMinutes: 240,
        status: 'scheduled',
      }),
    ]);

    await updateTable(
      test.db,
      gm,
      slug,
      input({ title: 'Sessão nova', startsAtLocal: '2099-10-11T20:00', durationMinutes: 180 }),
    );
    const moved = await tableAt(slug);
    expect(await sessionsOf(table.id)).toEqual([
      expect.objectContaining({
        startsAt: moved.startsAt,
        durationMinutes: 180,
        status: 'scheduled',
      }),
    ]);

    await closeTable(test.db, gm, slug);
    expect((await sessionsOf(table.id)).map(({ status }) => status)).toEqual(['cancelled']);
  });

  it('schedules a draft too, and cancels it when the draft is taken down', async () => {
    const { slug } = await createTable(test.db, gm, input({ title: 'Rascunho' }), {
      now,
      draft: true,
    });
    const table = await tableAt(slug);
    expect((await sessionsOf(table.id)).map(({ status }) => status)).toEqual(['scheduled']);

    await disableTable(test.db, gm, slug);
    expect((await sessionsOf(table.id)).map(({ status }) => status)).toEqual(['cancelled']);
  });

  it('a session that happened and goes on: held with who came, and the next one scheduled', async () => {
    const table = await awaitingTable();

    await holdSession(
      test.db,
      gm,
      table.slug,
      { presentPlayerIds: [ana.id], nextStartsAtLocal: '2026-10-08T19:00' },
      now,
    );

    const [held, next] = await sessionsOf(table.id);
    expect(held).toMatchObject({ startsAt: table.startsAt, status: 'held' });
    expect(next).toMatchObject({
      startsAt: (await tableAt(table.slug)).startsAt,
      status: 'scheduled',
    });
    const attendance = await test.db
      .select({
        playerId: tableSessionAttendance.playerId,
        attended: tableSessionAttendance.attended,
      })
      .from(tableSessionAttendance)
      .where(eq(tableSessionAttendance.sessionId, held.id));
    expect(attendance).toEqual(
      expect.arrayContaining([
        { playerId: ana.id, attended: true },
        { playerId: bia.id, attended: false },
      ]),
    );
    expect(attendance).toHaveLength(2);
  });

  it('a session skipped: not held, and the next one scheduled', async () => {
    const table = await awaitingTable();

    await skipSession(test.db, gm, table.slug, { nextStartsAtLocal: '2026-10-08T19:00' }, now);

    expect((await sessionsOf(table.id)).map(({ status }) => status)).toEqual([
      'not_held',
      'scheduled',
    ]);
  });

  it('a postponement moves the same session', async () => {
    const table = await awaitingTable();

    await postponeTable(test.db, gm, table.slug, '2026-10-09T19:00', now);

    const sessions = await sessionsOf(table.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      startsAt: (await tableAt(table.slug)).startsAt,
      status: 'scheduled',
    });
  });

  it('concluded or not held: the last session is closed and nothing stays scheduled', async () => {
    const happened = await awaitingTable({ kind: 'one_shot', recurrence: null });
    await concludeTable(test.db, gm, happened.slug, [ana.id, bia.id]);
    expect((await sessionsOf(happened.id)).map(({ status }) => status)).toEqual(['held']);

    const missed = await awaitingTable({ kind: 'one_shot', recurrence: null });
    await markTableNotHeld(test.db, gm, missed.slug);
    expect((await sessionsOf(missed.id)).map(({ status }) => status)).toEqual(['not_held']);
  });

  it('records a session for a table from before sessions were tracked', async () => {
    const table = await awaitingTable({ kind: 'one_shot', recurrence: null }, false);

    await concludeTable(test.db, gm, table.slug);

    expect(await sessionsOf(table.id)).toEqual([
      expect.objectContaining({ startsAt: table.startsAt, durationMinutes: 180, status: 'held' }),
    ]);
  });

  it('ending a table that goes on cancels the session that was next', async () => {
    const table = await awaitingTable({
      status: 'active',
      startsAt: new Date('2099-01-01T22:00:00Z'),
    });

    await finishTable(test.db, gm, table.slug);

    expect((await sessionsOf(table.id)).map(({ status }) => status)).toEqual(['cancelled']);
  });
});
