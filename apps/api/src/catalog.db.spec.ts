import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, platforms, profiles } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { catalogRoutes } from './catalog';

let test: Awaited<ReturnType<typeof createTestDb>>;
const admin = '00000000-0000-4000-8000-0000000008a1';
const member = '00000000-0000-4000-8000-0000000008a2';
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: admin, username: 'admin', role: 'admin' },
    { id: member, username: 'member', role: 'member' },
  ]);
});
afterAll(() => test.close());

// The api closes the connection it opens; the shared test database must stay open.
const app = () => catalogRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const post = (path: string, body: unknown, actor?: string) =>
  app().request(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(actor ? { [ACTOR_HEADER]: actor } : {}) },
      body: JSON.stringify(body),
    },
    env,
  );

describe('api catalog routes over a database', () => {
  it('creates an entry for an admin and answers the event to dispatch', async () => {
    const response = await post('/create', { kind: 'platform', name: 'Mesa Nova VTT' }, admin);

    expect(response.status).toBe(200);
    const { eventId } = (await response.json()) as { eventId: string };
    const [event] = await test.db.select().from(events).where(eq(events.id, eventId));
    expect(event.actorId).toBe(admin);
    const [row] = await test.db.select().from(platforms).where(eq(platforms.name, 'Mesa Nova VTT'));
    expect(row).toBeDefined();
  });

  it('refuses a name the catalog already has, on the field the form names', async () => {
    await post('/create', { kind: 'platform', name: 'Outra Plataforma' }, admin);

    const response = await post('/create', { kind: 'platform', name: 'Outra Plataforma' }, admin);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid', field: 'name' });
  });

  it('refuses a body the form schema would refuse', async () => {
    const response = await post('/approve', { kind: 'platform', id: 'not-a-uuid' }, admin);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid' });
  });

  it('knows only the six decisions', async () => {
    expect((await post('/delete-everything', {}, admin)).status).toBe(404);
  });

  it('does not take a header for an admin', async () => {
    const body = { kind: 'platform', name: 'Nao Deveria' };

    expect((await post('/create', body)).status).toBe(401);
    expect((await post('/create', body, member)).status).toBe(403);
    expect((await post('/create', body, '00000000-0000-4000-8000-00000000ffff')).status).toBe(403);
    const rows = await test.db.select().from(platforms).where(eq(platforms.name, 'Nao Deveria'));
    expect(rows).toHaveLength(0);
  });
});
