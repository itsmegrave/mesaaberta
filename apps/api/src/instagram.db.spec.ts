import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  gameTables,
  instagramAccounts,
  instagramPosts,
  profiles,
  systems,
} from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { instagramRoutes } from './instagram';

let test: Awaited<ReturnType<typeof createTestDb>>;
const admin = '00000000-0000-4000-8000-000000000ca1';
const member = '00000000-0000-4000-8000-000000000ca2';
const env = { DATABASE_URL: 'postgres://test' };
let tableId: string;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: admin, username: 'admin', role: 'admin' },
    { id: member, username: 'member', role: 'member' },
  ]);
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug: 'mesa-instagram',
      title: 'Mesa',
      kind: 'one_shot',
      capacity: 4,
      status: 'active',
      startsAt: new Date('2099-01-01T20:00:00Z'),
      durationMinutes: 60,
      timezone: 'UTC',
      gmId: member,
      systemId: system.id,
    })
    .returning();
  tableId = table.id;
  await test.db
    .insert(instagramPosts)
    .values({ tableId, eventId: crypto.randomUUID(), status: 'uncertain' });
});
afterAll(() => test.close());

const app = () => instagramRoutes((() => ({ db: test.db, close: async () => {} })) as never);
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

describe('api instagram routes over a database', () => {
  it('answers that Instagram is unavailable when it is not configured, and queues nothing', async () => {
    const response = await post('queue', { tableId }, admin);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ eventIds: [], result: 'unavailable' });
  });

  it('reconciles only an uncertain post, with the permalink the admin read from Instagram', async () => {
    const permalink = 'https://www.instagram.com/p/Abc_123-x/';

    const response = await post('reconcile', { tableId, permalink }, admin);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ eventIds: [], reconciled: true });
    const [row] = await test.db
      .select()
      .from(instagramPosts)
      .where(eq(instagramPosts.tableId, tableId));
    expect(row).toMatchObject({ status: 'published', permalink, image: null, lastError: null });
  });

  it('does not touch a post that is not uncertain', async () => {
    await test.db
      .update(instagramPosts)
      .set({ status: 'failed', permalink: null })
      .where(eq(instagramPosts.tableId, tableId));

    await post('reconcile', { tableId, permalink: 'https://www.instagram.com/p/Zzz/' }, admin);

    const [row] = await test.db
      .select()
      .from(instagramPosts)
      .where(eq(instagramPosts.tableId, tableId));
    expect(row.status).toBe('failed');
  });

  it('refuses a member, a permalink that is not Instagram’s and an unknown action', async () => {
    expect((await post('queue', { tableId }, member)).status).toBe(403);
    expect(
      (await post('reconcile', { tableId, permalink: 'https://evil.example/p/x/' }, admin)).status,
    ).toBe(400);
    expect((await post('explode', {}, admin)).status).toBe(404);
    expect((await post('queue', { tableId })).status).toBe(401);
  });

  it('saves the connected account with its encrypted token, and connecting again replaces it', async () => {
    const account = {
      userId: '1784',
      username: 'mesaaberta',
      token: 'enc:abc',
      expiresAt: '2099-01-01T00:00:00.000Z',
    };

    const first = await post('connect', account, admin);
    await post('connect', { ...account, username: 'mesa', token: 'enc:def' }, admin);

    expect(await first.json()).toEqual({ eventIds: [], connected: true });
    const rows = await test.db.select().from(instagramAccounts);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ username: 'mesa', token: 'enc:def' });
    expect(rows[0].expiresAt).toEqual(new Date(account.expiresAt));
  });

  it('refuses a member and a connection without a token', async () => {
    const account = { userId: '1', username: 'x', token: 't', expiresAt: '2099-01-01T00:00:00Z' };
    expect((await post('connect', account, member)).status).toBe(403);
    expect((await post('connect', { ...account, token: '' }, admin)).status).toBe(400);
  });
});
