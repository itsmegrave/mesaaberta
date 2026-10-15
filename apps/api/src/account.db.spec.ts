import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, profiles } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { accountRoutes } from './account';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000ba1';
const bia = '00000000-0000-4000-8000-000000000ba2';
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana', role: 'member' },
    { id: bia, username: 'bia', role: 'member' },
  ]);
});
afterAll(() => test.close());

let deleted: string[] = [];
const admin = {
  auth: {
    admin: {
      getUserById: async () => ({ data: { user: null }, error: null }),
      deleteUser: async (id: string) => {
        deleted.push(id);
        return { error: null };
      },
    },
  },
};
const app = () =>
  accountRoutes((() => ({ db: test.db, close: async () => {} })) as never, { admin });
const post = (action: string, body: unknown, actor?: string) =>
  app().request(
    `/${action}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(actor ? { [ACTOR_HEADER]: actor } : {}) },
      body: JSON.stringify(body),
    },
    env,
  );
const row = async (id: string) =>
  (await test.db.select().from(profiles).where(eq(profiles.id, id)))[0];

describe('api account routes over a database', () => {
  it('saves the actor’s own profile, keeping the stored username', async () => {
    const response = await post(
      'save',
      { username: 'someone-else', name: 'Ana Maria', city: 'Recife', linkNetwork: [], linkUrl: [] },
      ana,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ eventIds: [] });
    expect(await row(ana)).toMatchObject({ username: 'ana', name: 'Ana Maria', city: 'Recife' });
    expect(await row(bia)).toMatchObject({ username: 'bia', name: null });
    const written = await test.db.select().from(events).where(eq(events.actorId, ana));
    expect(written.map((e) => e.type)).toEqual(['ProfileUpdated']);
  });

  it('refuses an invalid form on the form’s terms', async () => {
    const response = await post('save', { name: 'x'.repeat(500) }, ana);

    expect(response.status).toBe(400);
  });

  it('switches direct messages for the actor only', async () => {
    const response = await post('messages', { enabled: false }, bia);

    expect(response.status).toBe(200);
    expect((await row(bia)).directMessagesEnabled).toBe(false);
    expect((await row(ana)).directMessagesEnabled).toBe(true);
  });

  it('answers 404 for an unknown action, 400 for a non-object, 401 without an actor', async () => {
    expect((await post('explode', {}, ana)).status).toBe(404);
    expect((await post('messages', [], ana)).status).toBe(400);
    expect((await post('messages', { enabled: true })).status).toBe(401);
  });

  it('points the profile at a stored picture and answers the one it replaced', async () => {
    const first = await post('avatar', { path: `${ana}/a.png` }, ana);
    expect(await first.json()).toEqual({ eventIds: [], replaced: null });

    const second = await post('avatar', { path: `${ana}/b.png` }, ana);
    expect(await second.json()).toEqual({ eventIds: [], replaced: `${ana}/a.png` });

    const removed = await post('avatar', { path: null }, ana);
    expect(await removed.json()).toEqual({ eventIds: [], replaced: `${ana}/b.png` });
    expect((await row(ana)).avatarPath).toBeNull();
  });

  it('finishes the profile with the username picked here, then keeps it', async () => {
    const [{ id }] = await test.db
      .insert(profiles)
      .values({ id: '00000000-0000-4000-8000-000000000ba9', role: 'member' })
      .returning({ id: profiles.id });
    const body = { name: 'Nova Pessoa', city: 'Recife', linkNetwork: [], linkUrl: [] };

    const first = await post('onboard', { ...body, username: 'novapessoa' }, id);
    expect(first.status).toBe(200);
    expect((await row(id)).username).toBe('novapessoa');

    await post('onboard', { ...body, username: 'outro' }, id);
    expect((await row(id)).username).toBe('novapessoa');
  });

  it('refuses a username somebody already has', async () => {
    const [{ id }] = await test.db
      .insert(profiles)
      .values({ id: '00000000-0000-4000-8000-000000000baa', role: 'member' })
      .returning({ id: profiles.id });

    const response = await post(
      'onboard',
      { username: 'ana', name: 'Outra', linkNetwork: [], linkUrl: [] },
      id,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ field: 'username', message: 'taken' });
  });

  it('refuses a picture outside the person’s own folder', async () => {
    const response = await post('avatar', { path: `${bia}/x.png` }, ana);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ field: 'photo' });
  });

  it('closes the account only when the username is typed, and deletes the Auth user', async () => {
    deleted = [];
    const wrong = await post('delete', { confirm: 'outra' }, bia);
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toMatchObject({ field: 'confirm' });
    expect(deleted).toEqual([]);

    const response = await post('delete', { confirm: 'bia' }, bia);

    expect(response.status).toBe(200);
    expect(deleted).toEqual([bia]);
    expect((await row(bia)).username).toBeNull();
  });
});
