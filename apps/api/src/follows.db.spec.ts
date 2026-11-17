import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { follows, gameTables, profiles, systems } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { followRoutes } from './follows';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-000000000f11';
const ana = '00000000-0000-4000-8000-000000000f12';
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestre', role: 'member' },
    { id: ana, username: 'ana', role: 'member' },
  ]);
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const table = {
    title: 'Mesa',
    kind: 'one_shot',
    capacity: 3,
    startsAt: new Date('2099-01-01T20:00:00Z'),
    durationMinutes: 60,
    timezone: 'UTC',
    gmId: gm,
    systemId: system.id,
  };
  await test.db.insert(gameTables).values([
    { ...table, slug: 'mesa-aberta' },
    { ...table, slug: 'mesa-rascunho', status: 'draft' },
  ] as never);
});
afterAll(() => test.close());

const app = () => followRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const call = (path: string, actor: string | null, body?: unknown) =>
  app().request(
    path,
    {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(actor ? { [ACTOR_HEADER]: actor } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );

describe('api follow routes over a database', () => {
  it('follows someone once, with its event, and says so', async () => {
    const first = await call(`/${gm}`, ana, { follow: true });
    expect(first.status).toBe(200);
    expect((await first.json()).eventIds).toHaveLength(1);
    expect(await (await call(`/${gm}`, ana, { follow: true })).json()).toEqual({ eventIds: [] });
    expect(await (await call(`/${gm}`, ana)).json()).toEqual({ following: true });
  });

  it('refuses following oneself, and answers 404 to someone unknown', async () => {
    expect((await call(`/${ana}`, ana, { follow: true })).status).toBe(403);
    expect(
      (await call('/00000000-0000-4000-8000-000000000fff', ana, { follow: true })).status,
    ).toBe(404);
    expect((await call('/not-an-id', ana, { follow: true })).status).toBe(404);
  });

  it('lists "Seguindo", and a page past the last is a 404', async () => {
    expect(await (await call('/', ana)).json()).toMatchObject({
      following: { people: [{ id: gm, username: 'mestre' }], total: 1, page: 1 },
      followers: 0,
    });
    expect((await call('/?page=2', ana)).status).toBe(404);
  });

  it('answers the GM row of a table, visitors too, and hides a draft', async () => {
    expect(await (await call('/gm/mesa-aberta', ana)).json()).toEqual({
      profileId: gm,
      following: true,
    });
    expect(await (await call('/gm/mesa-aberta', null)).json()).toEqual({
      profileId: gm,
      following: false,
    });
    expect((await call('/gm/mesa-rascunho', ana)).status).toBe(404);
    expect((await call('/gm/mesa-rascunho', gm)).status).toBe(200);
  });

  it('saves the bell switches and stops following', async () => {
    expect((await call('/notices', ana, { tables: false, seats: true })).status).toBe(200);
    expect((await call(`/${gm}`, ana, { follow: false })).status).toBe(200);
    expect(await test.db.select().from(follows)).toEqual([]);
  });
});
