import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gameTables, profiles, systems } from '@mesaaberta/db/schema';
import { adminOverview } from '@mesaaberta/core/server/admin/queries';
import { listAdminProfiles } from '@mesaaberta/core/server/admin/profiles';
import { listAdminTables } from '@mesaaberta/core/server/admin/tables';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { adminReadRoutes } from './admin-reads';

let test: Awaited<ReturnType<typeof createTestDb>>;
const root = '00000000-0000-4000-8000-000000000fa1';
const member = '00000000-0000-4000-8000-000000000fa2';
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: root, username: 'root', role: 'admin' },
    { id: member, username: 'membro', role: 'member' },
  ]);
  const [system] = await test.db
    .insert(systems)
    .values({ name: 'Sys', slug: 'sys', status: 'approved', position: 1 } as never)
    .returning({ id: systems.id });
  await test.db.insert(gameTables).values({
    slug: 'mesa-admin',
    title: 'Mesa admin',
    kind: 'one_shot',
    capacity: 4,
    status: 'active',
    startsAt: new Date('2099-01-01T20:00:00Z'),
    durationMinutes: 60,
    timezone: 'UTC',
    gmId: member,
    systemId: system.id,
  });
});
afterAll(() => test.close());

const app = adminReadRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const get = (path: string, actor: string | null = root) =>
  app.request(path, { headers: actor ? { [ACTOR_HEADER]: actor } : {} }, env);
const json = (value: unknown) => JSON.parse(JSON.stringify(value));

describe('GET /v1/admin-reads', () => {
  it('overview answers what the in-process query builds', async () => {
    const answer = await get('/overview');
    expect(answer.status).toBe(200);
    const body = (await answer.json()) as { updatedAt: string };
    // `updatedAt` is each call's own clock: it must be a date, everything else must match.
    expect(Date.parse(body.updatedAt)).not.toBeNaN();
    const expected = json(await adminOverview(test.db));
    expect({ ...body, updatedAt: null }).toEqual({ ...expected, updatedAt: null });
  });

  it('users answers what the in-process list builds for the same filters', async () => {
    const answer = await get('/users?q=root&sort=user');
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual(
      json(await listAdminProfiles(test.db, new URLSearchParams('q=root&sort=user'))),
    );
  });

  it('tables answers what the in-process list builds for the same filters', async () => {
    const answer = await get('/tables');
    expect(answer.status).toBe(200);
    const body = (await answer.json()) as { rows: { slug: string }[] };
    expect(body.rows.map((row) => row.slug)).toContain('mesa-admin');
    expect(body).toEqual({
      ...json(await listAdminTables(test.db, new URLSearchParams())),
      // No Instagram account connected in the test database.
      socialExpiresAt: null,
    });
  });

  it('refuses anyone who is not an admin, and needs an actor', async () => {
    for (const path of ['/overview', '/users', '/tables']) {
      expect((await get(path, member)).status).toBe(403);
      expect((await get(path, null)).status).toBe(401);
    }
  });

  it('answers the counts, badges, audit log, reports and recipients', async () => {
    expect(await (await get('/counts')).json()).toMatchObject({ reports: 0, queue: 0, events: 0 });
    expect((await get('/badges')).status).toBe(200);
    expect((await get('/audit')).status).toBe(200);
    expect((await get('/reports')).status).toBe(200);
    expect((await get('/audit?page=99')).status).toBe(404);
    expect(await (await get('/recipients?q=memb')).json()).toEqual(['membro']);
  });

  it('answers one table with its history, and 404 for an unknown or malformed id', async () => {
    const [table] = (await (await get('/tables')).json()).rows as { id: string; slug: string }[];
    expect(await (await get(`/tables/${table.id}`)).json()).toMatchObject({
      table: { slug: 'mesa-admin' },
      history: expect.any(Object),
    });
    expect((await get('/tables/00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await get('/tables/nope')).status).toBe(404);
    expect((await get('/reports/nope')).status).toBe(404);
  });

  it('answers the review lists, the catalog console and its queue, and the announcements', async () => {
    for (const path of ['/places', '/claims', '/crowdfundings', '/partners'])
      expect((await get(path)).status).toBe(200);
    expect((await get('/places?page=99')).status).toBe(404);
    expect(await (await get('/catalog?kind=tag')).json()).toMatchObject({ kind: 'tag', page: 1 });
    expect((await get('/catalog?page=99')).status).toBe(404);
    expect(await (await get('/queue')).json()).toHaveProperty('approved');
    expect(await (await get('/announcements')).json()).toHaveProperty('sizes');
  });

  it('answers one person for the admin, their badges only when asked', async () => {
    const plain = await (await get(`/users/${member}`)).json();
    expect(plain).toMatchObject({ profile: { username: 'membro' }, badges: null });
    expect((await (await get(`/users/${member}?badges=1`)).json()).badges).not.toBeNull();
    expect((await get('/users/00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });
});
