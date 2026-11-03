import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Extension } from '@mesaaberta/core/server/extensions/index';
import { profiles } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { settingsRoutes } from './settings';

let test: Awaited<ReturnType<typeof createTestDb>>;
const member = '00000000-0000-4000-8000-000000000cb1';
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([{ id: member, username: 'member', role: 'member' }]);
});
afterAll(() => test.close());

// The public build installs no extension, so the routes are tested with their own.
const forPerson = vi.fn(async (_db: unknown, profileId: string) =>
  profileId === member ? { kind: 'pick', data: { choice: 'a' } } : null,
);
const save = vi.fn(async (_db: unknown, _id: string, fields: Readonly<Record<string, string>>) =>
  fields.choice === 'bad'
    ? ({ invalid: true } as const)
    : { card: { kind: 'pick', data: { choice: fields.choice } } },
);
const installed: Extension[] = [{ id: 'plain' }, { id: 'picker', settings: { forPerson, save } }];
const app = settingsRoutes((() => ({ db: test.db, close: async () => {} })) as never, installed);
const post = (ext: string, fields: unknown, actor: string | null = member) =>
  app.request(
    `/${ext}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(actor ? { [ACTOR_HEADER]: actor } : {}) },
      body: JSON.stringify({ fields }),
    },
    env,
  );

describe('/v1/settings', () => {
  it('refuses a visitor', async () => {
    expect((await app.request('/', {}, env)).status).toBe(401);
    expect((await post('picker', { choice: 'b' }, null)).status).toBe(401);
  });

  it("lists the extensions' cards for the actor", async () => {
    const res = await app.request('/', { headers: { [ACTOR_HEADER]: member } }, env);
    expect(await res.json()).toEqual({
      cards: [{ ext: 'picker', card: { kind: 'pick', data: { choice: 'a' } } }],
    });
  });

  it('saves the string fields of a card and answers the card as it now stands', async () => {
    const res = await post('picker', { choice: 'b', n: 3 });
    expect(await res.json()).toEqual({ card: { kind: 'pick', data: { choice: 'b' } } });
    expect(save.mock.calls.at(-1)?.slice(1, 3)).toEqual([member, { choice: 'b' }]);
  });

  it('answers 400 for refused fields and 404 for an extension without settings', async () => {
    expect((await post('picker', { choice: 'bad' })).status).toBe(400);
    expect((await post('plain', {})).status).toBe(404);
    expect((await post('missing', {})).status).toBe(404);
  });
});
