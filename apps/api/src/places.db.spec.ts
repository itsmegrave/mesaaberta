import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { profiles } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { placeRoutes } from './places';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000c01';
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: ana, username: 'ana' });
});
afterAll(() => test.close());

const app = () => placeRoutes((() => ({ db: test.db, close: async () => {} })) as never);
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

describe('api place routes over a database', () => {
  it('answers 404 for a place to edit or claim that is not there', async () => {
    expect((await call('/no-such-place/edit')).status).toBe(404);
    expect((await call('/no-such-place/claim')).status).toBe(404);
  });

  it('refuses a malformed place or claim, and anyone signed out', async () => {
    expect((await call('/', ana, { input: { name: '' } })).status).toBe(400);
    expect((await call('/no-such-place/claim', ana, { relation: 'x' })).status).toBe(400);
    expect((await call('/no-such-place/edit', null)).status).toBe(401);
  });
});
