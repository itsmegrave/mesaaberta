import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { follows, profiles } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { profileRoutes } from './profiles';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000b01';
const bia = '00000000-0000-4000-8000-000000000b02';
const env = { DATABASE_URL: 'postgres://test', SUPABASE_URL: 'https://storage.test' };
const app = profileRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const get = (path: string, actor?: string) =>
  app.request(path, { headers: actor ? { 'x-actor-id': actor } : {} }, env);

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana', avatarPath: `${ana}/me.png` },
    { id: bia, username: 'bia' },
    { id: '00000000-0000-4000-8000-000000000b03', username: 'gone', status: 'suspended' },
  ]);
  await test.db.insert(follows).values({ followerId: bia, followeeId: ana });
});
afterAll(async () => test?.close());

describe('GET /v1/profiles/:username', () => {
  it('answers a visitor the public page, with who it is about and picture URLs', async () => {
    const response = await get('/ana');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      subject: { id: ana, isAdmin: false },
      follows: { following: false, followers: null },
      isOwner: false,
      page: 1,
      profile: { username: 'ana', avatarUrl: expect.stringContaining('https://storage.test/') },
    });
  });
  it('reads the follow part for the viewer it is told about', async () => {
    await expect((await get('/ana', bia)).json()).resolves.toMatchObject({
      follows: { following: true, followers: null },
      isOwner: false,
    });
    await expect((await get('/ana', ana)).json()).resolves.toMatchObject({
      follows: { following: false, followers: 1 },
      isOwner: true,
    });
  });
  it('is a 404 for an unknown or inactive person, a bad page or one past the last', async () => {
    for (const path of ['/nobody', '/gone', '/ana?page=0', '/ana?page=x', '/ana?page=2'])
      expect((await get(path)).status, path).toBe(404);
  });
});
