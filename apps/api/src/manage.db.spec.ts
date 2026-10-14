import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, gameTables, profiles, systems } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { manageRoutes } from './manage';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-0000000009a1';
const other = '00000000-0000-4000-8000-0000000009a2';
const env = { DATABASE_URL: 'postgres://test' };
const slug = 'mesa-manage';
let tableId: string;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestre', role: 'member' },
    { id: other, username: 'outra', role: 'member' },
  ]);
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: 'Rascunho',
      kind: 'one_shot',
      capacity: 4,
      status: 'draft',
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

const app = () => manageRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const post = (action: string, body: unknown, actor?: string, table = slug) =>
  app().request(
    `/${table}/${action}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(actor ? { [ACTOR_HEADER]: actor } : {}) },
      body: JSON.stringify(body),
    },
    env,
  );

describe('api manage routes over a database', () => {
  it('refuses someone who is not the GM, and changes nothing', async () => {
    const response = await post('publish', {}, other);

    expect(response.status).toBe(403);
    const [row] = await test.db.select().from(gameTables).where(eq(gameTables.id, tableId));
    expect(row.status).toBe('draft');
  });

  it('publishes the draft for its GM and answers the event, as the GM', async () => {
    const response = await post('publish', {}, gm);

    expect(response.status).toBe(200);
    const { eventIds } = (await response.json()) as { eventIds: string[] };
    expect(eventIds).toHaveLength(1);
    const [event] = await test.db.select().from(events).where(eq(events.id, eventIds[0]));
    expect(event.actorId).toBe(gm);
    const [row] = await test.db.select().from(gameTables).where(eq(gameTables.id, tableId));
    expect(row.status).toBe('active');
  });

  it('answers the field and code of a refusal the form shows', async () => {
    const response = await post('publish', {}, gm);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'invalid',
      field: 'slug',
      message: 'not_a_draft',
    });
  });

  it('refuses a malformed date, an unknown table and an unknown action', async () => {
    expect((await post('postpone', { startsAtLocal: 'soon' }, gm)).status).toBe(400);
    expect((await post('happened', {}, gm, 'nope')).status).toBe(404);
    expect((await post('explode', {}, gm)).status).toBe(404);
    expect((await post('happened', {})).status).toBe(401);
  });
});
