import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { notifications, profiles } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { meRoutes } from './me';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000f01';
const admin = '00000000-0000-4000-8000-000000000f02';
const nobody = '00000000-0000-4000-8000-000000000f03';
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana', role: 'member' },
    { id: admin, username: 'admin', role: 'admin' },
  ]);
  await test.db.insert(notifications).values([
    { recipientId: ana, category: 'table', type: 'table_updated', link: '/t/a' },
    { recipientId: ana, category: 'achievements', type: 'badge_awarded', link: '/u/ana' },
  ] as never);
});
afterAll(() => test.close());

const app = () => meRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const get = (path: string, actor: string | null) =>
  app().request(path, { headers: actor ? { [ACTOR_HEADER]: actor } : {} }, env);

describe('api me routes over a database', () => {
  it('answers the profile row of the actor, null for an account with no profile', async () => {
    expect(await (await get('/', ana)).json()).toMatchObject({
      profile: { id: ana, username: 'ana', role: 'member', status: 'active' },
    });
    expect(await (await get('/', nobody)).json()).toEqual({ profile: null });
    expect((await get('/', null)).status).toBe(401);
  });

  it('answers the header numbers, the badge notices only when they are on', async () => {
    const shell = await (await get('/shell', ana)).json();
    expect(shell).toMatchObject({ unread: 1, messagesUnread: 0, pendingSuggestions: 0 });
    expect(shell.latest).toHaveLength(1);
    expect(await (await get('/shell?achievements=1', ana)).json()).toMatchObject({ unread: 2 });
    expect(await (await get('/badges?achievements=1', ana)).json()).toEqual({
      unread: 2,
      messages: 0,
    });
    expect((await get('/shell', nobody)).status).toBe(403);
  });

  it('counts the waiting suggestions only for an admin', async () => {
    const shell = await (await get('/shell', admin)).json();
    expect(typeof shell.pendingSuggestions).toBe('number');
  });

  it("answers the actor's own profile form, username availability and export", async () => {
    expect(await (await get('/profile-form', ana)).json()).toMatchObject({ username: 'ana' });
    expect(await (await get('/username-available?username=ana', ana)).json()).toEqual({
      available: true,
    });
    expect(await (await get('/username-available?username=admin', ana)).json()).toEqual({
      available: false,
    });
    expect((await get('/export?email=ana@x.test', ana)).status).toBe(200);
    expect(await (await get('/favorite-systems', ana)).json()).toMatchObject({ favorites: [] });
  });

  it('says whether the actor is under a limit, and 404 for a limit it does not know', async () => {
    expect(await (await get('/limits/table', ana)).json()).toEqual({ ok: true });
    expect((await get('/limits/whatever', ana)).status).toBe(404);
  });

  it('answers a page of the feed, a bad page as the first and one past the last as a 404', async () => {
    expect(await (await get('/notifications?page=abc&achievements=1', ana)).json()).toMatchObject({
      page: 1,
      pages: 1,
      unreadTotal: 2,
      items: [{}, {}],
    });
    expect(await (await get('/notifications?category=table&unread=1', ana)).json()).toMatchObject({
      items: [{ category: 'table' }],
      unreadTotal: 1,
    });
    expect((await get('/notifications?page=2', ana)).status).toBe(404);
  });
});
