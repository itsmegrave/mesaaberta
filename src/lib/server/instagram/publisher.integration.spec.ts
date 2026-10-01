import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { openIntegrationDb } from '../db/integration-db';
import { gameTables, instagramAccounts, instagramPosts, profiles, systems } from '../db/schema';
import { encryptToken, type InstagramEnv, type graph } from './api';
import { publishInstagramPosts, publishInstagramTable } from './publisher';

const { db, close } = openIntegrationDb();
const gmId = crypto.randomUUID();
let tableId: string;
const env: InstagramEnv = {
  APP_ORIGIN: 'https://mesaaberta.app',
  INSTAGRAM_APP_ID: 'test',
  INSTAGRAM_APP_SECRET: 'test',
  INSTAGRAM_TOKEN_KEY: Buffer.alloc(32, 1).toString('base64'),
};
const now = new Date();
beforeAll(async () => {
  await db.insert(profiles).values({ id: gmId, username: `ig${gmId.slice(0, 8)}` });
  const [system] = await db.select().from(systems).limit(1);
  const [table] = await db
    .insert(gameTables)
    .values({
      gmId,
      systemId: system.id,
      title: 'Instagram race',
      slug: `ig-${gmId}`,
      kind: 'one_shot',
      capacity: 5,
      startsAt: new Date('2099-01-01T20:00:00Z'),
      durationMinutes: 180,
      timezone: 'UTC',
    })
    .returning();
  tableId = table.id;
  await db.insert(instagramAccounts).values({
    userId: 'ig-user',
    username: 'test',
    token: await encryptToken('token', env.INSTAGRAM_TOKEN_KEY!),
    expiresAt: new Date(now.getTime() + 30 * 86400_000),
  });
  await db
    .insert(instagramPosts)
    .values({ tableId, eventId: crypto.randomUUID(), nextAttemptAt: now });
});
afterAll(async () => {
  if (tableId) await db.delete(gameTables).where(eq(gameTables.id, tableId));
  await db.delete(profiles).where(eq(profiles.id, gmId));
  await db.delete(instagramAccounts).where(eq(instagramAccounts.username, 'test'));
  await close();
});
describe('Instagram job leases on real Postgres', () => {
  it('publishes once when a manual request races the cron', async () => {
    const request = vi.fn(async (_env, _token, path) => {
      if (path === 'ig-user/media') return { id: 'container' };
      if (path === 'container') return { status_code: 'FINISHED' };
      if (path === 'ig-user/media_publish') return { id: 'media' };
      return { permalink: 'https://www.instagram.com/p/test/' };
    });
    const render = vi.fn(async () => new Uint8Array([255, 216, 255, 217]));
    const deps = { render, api: request as unknown as typeof graph };
    await Promise.all([
      publishInstagramTable(db, env, tableId, now, deps),
      publishInstagramPosts(db, env, now, deps),
    ]);
    const [post] = await db
      .select()
      .from(instagramPosts)
      .where(eq(instagramPosts.tableId, tableId));
    expect(post.status).toBe('published');
    expect(request.mock.calls.filter((call) => call[2] === 'ig-user/media_publish')).toHaveLength(
      1,
    );
    expect(render).toHaveBeenCalledOnce();
  });
});
