import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { profiles } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { crowdfundingRoutes } from './crowdfundings';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000b01';
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: ana, username: 'ana' });
});
afterAll(() => test.close());

const app = () => crowdfundingRoutes((() => ({ db: test.db, close: async () => {} })) as never);
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

describe('api crowdfunding routes over a database', () => {
  it('answers the list to visitors', async () => {
    const list = await call('/', null);
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ running: [], pages: 1 });
  });

  it('says whether a link is listed, and counts link reads up to the limit', async () => {
    expect(await (await call('/listed?url=https://www.catarse.me/x')).json()).toEqual({
      listed: false,
    });
    let status = 200;
    for (let i = 0; i < 50 && status === 200; i++)
      status = (await call('/link-read', ana, {})).status;
    expect(status).toBe(429);
    expect((await call('/link-read', null, {})).status).toBe(401);
  });
});
