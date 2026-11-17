import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { profiles } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { partnerRoutes } from './partners';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000d01';
const env = { DATABASE_URL: 'postgres://test' };
const unknown = '00000000-0000-4000-8000-000000000dff';

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: ana, username: 'ana' });
});
afterAll(() => test.close());

const app = () => partnerRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const call = (path: string, actor: string | null = ana, body?: object) =>
  app().request(
    path,
    {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(actor ? { [ACTOR_HEADER]: actor } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    env,
  );

describe('api partner routes over a database', () => {
  it('answers the list to visitors, and 404 past the last page', async () => {
    const list = await call('/', null);
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ cards: [], pages: 1 });
    expect((await call('/?page=9', null)).status).toBe(404);
  });

  it('answers 404 for a partner or an invite that is not there, and a malformed id', async () => {
    expect((await call(`/${unknown}/edit`)).status).toBe(404);
    expect((await call('/not-an-id/edit')).status).toBe(404);
    expect((await call(`/invitations/${unknown}`)).status).toBe(404);
    expect((await call(`/invitations/${unknown}/accept`, ana, {})).status).toBe(404);
  });

  it('refuses a malformed owner write and anyone signed out', async () => {
    expect((await call(`/${unknown}/owners/invite`, ana, { username: '' })).status).toBe(400);
    expect((await call(`/${unknown}/edit`, null)).status).toBe(401);
  });
});
