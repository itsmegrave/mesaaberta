import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
const publishTable = vi.fn(async () => 'published' as const);
const withPanel: Extension = {
  id: 'panelled',
  admin: { count: async () => 0, load: async (_db, env) => ({ hasKey: 'KEY' in (env as object) }) },
  social: { name: 'panelled', publishTable } as unknown as NonNullable<Extension['social']>,
};

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

  it('answers an extension’s panel for an admin only', async () => {
    const get = (actor: string) =>
      app([withPanel]).request(
        '/panelled/panel',
        { headers: { [ACTOR_HEADER]: actor } },
        { ...env, KEY: 'x' },
      );
    expect(await (await get(admin)).json()).toEqual({ panel: { hasKey: true } });
    expect((await get(member)).status).toBe(403);
  });

  it('publishes a queued table after its answer, with the installed connector', async () => {
    const send = (tableId: string) =>
      app([withPanel]).request(
        '/social/publish',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', [ACTOR_HEADER]: admin },
          body: JSON.stringify({ tableId }),
        },
        env,
      );
    expect((await send('nope')).status).toBe(400);
    const tableId = '00000000-0000-4000-8000-000000000cb1';
    expect((await send(tableId)).status).toBe(202);
    await vi.waitFor(() =>
      expect(publishTable).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        tableId,
        expect.any(Date),
        { useTableImage: false },
      ),
    );
  });
});
