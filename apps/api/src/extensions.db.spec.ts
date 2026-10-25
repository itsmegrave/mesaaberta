import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Extension } from '@mesaaberta/core/server/extensions/index';
import { profiles } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { extensionRoutes } from './extensions';

let test: Awaited<ReturnType<typeof createTestDb>>;
const admin = '00000000-0000-4000-8000-000000000ca1';
const member = '00000000-0000-4000-8000-000000000ca2';
const env = { DATABASE_URL: 'postgres://test' };

// The public build installs no extension, so the route is tested with one of its own.
const fake: Extension = {
  id: 'fake',
  adminActions: {
    echo: {
      schema: z.object({ n: z.number() }),
      apply: async (_db, _env, data: { n: number }) => ({ echoed: data.n }),
    },
  },
};
const plain: Extension = { id: 'plain' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: admin, username: 'admin', role: 'admin' },
    { id: member, username: 'member', role: 'member' },
  ]);
});
afterAll(() => test.close());

const app = (installed: readonly Extension[] = [fake, plain]) =>
  extensionRoutes((() => ({ db: test.db, close: async () => {} })) as never, installed);
const post = (
  action: string,
  body: unknown,
  actor?: string,
  extension = 'fake',
  list?: Extension[],
) =>
  app(list).request(
    `/${extension}/${action}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(actor ? { [ACTOR_HEADER]: actor } : {}) },
      body: JSON.stringify(body),
    },
    env,
  );

describe('api extension routes over a database', () => {
  it('runs an installed extension’s admin action for an admin', async () => {
    const response = await post('echo', { n: 3 }, admin);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ eventIds: [], echoed: 3 });
  });

  it('refuses a member, a visitor and data the schema refuses', async () => {
    expect((await post('echo', { n: 3 }, member)).status).toBe(403);
    expect((await post('echo', { n: 3 })).status).toBe(401);
    expect((await post('echo', { n: 'three' }, admin)).status).toBe(400);
  });

  it('answers 404 for an unknown action, an extension nobody installed or one with no admin actions', async () => {
    expect((await post('explode', {}, admin)).status).toBe(404);
    expect((await post('echo', { n: 1 }, admin, 'missing')).status).toBe(404);
    expect((await post('echo', { n: 1 }, admin, 'plain')).status).toBe(404);
    expect((await post('echo', { n: 1 }, admin, 'toString')).status).toBe(404);
  });

  it('answers 404 for everything in the public build, which installs nothing', async () => {
    expect((await post('queue', { tableId: 'x' }, admin, 'instagram', [])).status).toBe(404);
  });
});
