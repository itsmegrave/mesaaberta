import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, gameTables, profiles, registrations, systems } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { registrationRoutes } from './registrations';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-0000000008a1';
const ana = '00000000-0000-4000-8000-0000000008a2';
const bia = '00000000-0000-4000-8000-0000000008a3';
const env = { DATABASE_URL: 'postgres://test' };
let slug: string;
let tableId: string;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestre', role: 'member' },
    { id: ana, username: 'ana', role: 'member' },
    { id: bia, username: 'bia', role: 'member' },
  ]);
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  slug = 'mesa-api';
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: 'Mesa',
      kind: 'one_shot',
      capacity: 1,
      startsAt: new Date('2099-01-01T20:00:00Z'),
      durationMinutes: 60,
      timezone: 'UTC',
      gmId: gm,
      systemId: system.id,
    })
    .returning();
  tableId = table.id;
});
afterAll(() => test.close());

// The api closes the connection it opens; the shared test database must stay open.
const app = () => registrationRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const post = (action: string, body: unknown, actor?: string) =>
  app().request(
    `/${slug}/${action}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(actor ? { [ACTOR_HEADER]: actor } : {}) },
      body: JSON.stringify(body),
    },
    env,
  );

describe('api registration routes over a database', () => {
  it('seats a player and answers the event to dispatch, as that player', async () => {
    const response = await post('join', { message: '' }, ana);

    expect(response.status).toBe(200);
    const { eventIds } = (await response.json()) as { eventIds: string[] };
    expect(eventIds).toHaveLength(1);
    const [event] = await test.db.select().from(events).where(eq(events.id, eventIds[0]));
    expect(event).toMatchObject({ type: 'PlayerJoined', actorId: ana });
    const rows = await test.db
      .select()
      .from(registrations)
      .where(eq(registrations.tableId, tableId));
    expect(rows).toHaveLength(1);
  });

  it('answers a repeat join as already_registered, the code the form shows', async () => {
    const response = await post('join', {}, ana);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'already_registered' });
  });

  it('answers a join to a full table as table_full', async () => {
    const response = await post('join', {}, bia);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'table_full' });
  });

  it('refuses a player removing someone: only the GM may', async () => {
    const response = await post('remove', { playerId: ana }, bia);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
  });

  it('lets the GM remove the player', async () => {
    const response = await post('remove', { playerId: ana }, gm);

    expect(response.status).toBe(200);
    const rows = await test.db
      .select()
      .from(registrations)
      .where(eq(registrations.tableId, tableId));
    expect(rows).toHaveLength(0);
  });

  it('answers not_found for a leave without a registration and for an unknown table', async () => {
    expect((await post('leave', {}, bia)).status).toBe(404);
    const missing = await app().request(
      '/nope/join',
      { method: 'POST', headers: { [ACTOR_HEADER]: bia }, body: '{}' },
      env,
    );
    expect(missing.status).toBe(404);
  });

  it('refuses a malformed player id and an unknown action', async () => {
    expect((await post('remove', { playerId: 'x' }, gm)).status).toBe(400);
    expect((await post('explode', {}, gm)).status).toBe(404);
  });

  it('refuses a call without an actor, or from a profile that does not exist', async () => {
    expect((await post('join', {})).status).toBe(401);
    expect((await post('join', {}, '00000000-0000-4000-8000-0000000008ff')).status).toBe(403);
  });
});
