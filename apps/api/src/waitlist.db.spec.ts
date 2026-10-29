import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  events,
  gameTables,
  profiles,
  registrations,
  systems,
  tableWaitlist,
} from '@mesaaberta/db/schema';
import { waitlistOf } from '@mesaaberta/core/server/registrations/waitlist';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { registrationRoutes } from './registrations';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-0000000009a1';
const ana = '00000000-0000-4000-8000-0000000009a2';
const bia = '00000000-0000-4000-8000-0000000009a3';
const caio = '00000000-0000-4000-8000-0000000009a4';
const env = { DATABASE_URL: 'postgres://test' };
let systemId: string;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestra-fila', role: 'member' },
    { id: ana, username: 'ana-fila', role: 'member' },
    { id: bia, username: 'bia-fila', role: 'member' },
    { id: caio, username: 'caio-fila', role: 'member' },
  ]);
  [{ id: systemId }] = await test.db.select({ id: systems.id }).from(systems).limit(1);
});
afterAll(() => test.close());

async function tableOf(slug: string, joinMode: 'auto' | 'approval') {
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: 'Mesa com fila',
      kind: 'one_shot',
      joinMode,
      status: 'active',
      capacity: 1,
      startsAt: new Date('2099-01-01T20:00:00Z'),
      durationMinutes: 60,
      timezone: 'UTC',
      gmId: gm,
      systemId,
    })
    .returning();
  return table;
}

const app = () => registrationRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const post = (slug: string, action: string, body: unknown, actor: string) =>
  app().request(
    `/${slug}/${action}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', [ACTOR_HEADER]: actor },
      body: JSON.stringify(body),
    },
    env,
  );
const statusOf = async (tableId: string, playerId: string) =>
  (
    await test.db
      .select({ status: registrations.status })
      .from(registrations)
      .where(and(eq(registrations.tableId, tableId), eq(registrations.playerId, playerId)))
  )[0]?.status ?? null;

describe('lista de espera', () => {
  it('refuses the line while a seat is left, then takes people in order once the table is full', async () => {
    const table = await tableOf('fila-auto', 'auto');

    expect((await post(table.slug, 'waitlist', {}, bia)).status).toBe(400);
    expect((await post(table.slug, 'join', {}, ana)).status).toBe(200);
    expect((await post(table.slug, 'waitlist', {}, bia)).status).toBe(200);
    expect((await post(table.slug, 'waitlist', {}, caio)).status).toBe(200);
    // The GM and a seated player cannot get in line.
    expect((await post(table.slug, 'waitlist', {}, gm)).status).toBe(403);
    expect((await post(table.slug, 'waitlist', {}, ana)).status).toBe(409);

    expect(await waitlistOf(test.db, table.id, caio)).toEqual({ size: 2, position: 2 });
    expect(await waitlistOf(test.db, table.id, null)).toEqual({ size: 2, position: null });
  });

  it('gives the freed seat to the first in line, with an event that says so', async () => {
    const [table] = await test.db.select().from(gameTables).where(eq(gameTables.slug, 'fila-auto'));

    const response = await post(table.slug, 'leave', {}, ana);

    expect(response.status).toBe(200);
    const { eventIds } = (await response.json()) as { eventIds: string[] };
    expect(eventIds).toHaveLength(2);
    const [joined] = await test.db.select().from(events).where(eq(events.id, eventIds[1]));
    expect(joined).toMatchObject({
      type: 'PlayerJoined',
      actorId: bia,
      payload: { playerId: bia, fromWaitlist: true },
    });
    expect(await statusOf(table.id, bia)).toBe('confirmed');
    expect(await waitlistOf(test.db, table.id, caio)).toEqual({ size: 1, position: 1 });
  });

  it('lets a player leave the line', async () => {
    const [table] = await test.db.select().from(gameTables).where(eq(gameTables.slug, 'fila-auto'));

    expect((await post(table.slug, 'unwaitlist', {}, caio)).status).toBe(200);

    expect(
      await test.db.select().from(tableWaitlist).where(eq(tableWaitlist.tableId, table.id)),
    ).toEqual([]);
  });

  it('sends the first in line to the GM as a request at a table that approves each player', async () => {
    const table = await tableOf('fila-aprovacao', 'approval');
    expect((await post(table.slug, 'join', {}, ana)).status).toBe(200);
    expect((await post(table.slug, 'approve', { playerId: ana }, gm)).status).toBe(200);
    expect((await post(table.slug, 'waitlist', {}, bia)).status).toBe(200);
    expect((await post(table.slug, 'waitlist', {}, caio)).status).toBe(200);

    expect((await post(table.slug, 'remove', { playerId: ana }, gm)).status).toBe(200);

    // One free seat, one open request: the line waits for the GM.
    expect(await statusOf(table.id, bia)).toBe('pending');
    expect(await statusOf(table.id, caio)).toBeNull();

    // Declined, the request makes room for the next in line.
    expect((await post(table.slug, 'decline', { playerId: bia }, gm)).status).toBe(200);
    expect(await statusOf(table.id, caio)).toBe('pending');
    expect(await waitlistOf(test.db, table.id, null)).toEqual({ size: 0, position: null });
  });
});
