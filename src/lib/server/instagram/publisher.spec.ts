import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db';
import {
  events,
  gameTables,
  instagramAccounts,
  instagramPosts,
  profiles,
  systems,
} from '../db/schema';
import { encryptToken, InstagramError, type InstagramEnv, graph } from './api';
import { instagramQueueHandler, publishInstagramPosts, publishInstagramTable } from './publisher';
import type { StoredEvent } from '../events/types';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gmId = '00000000-0000-4000-8000-000000001101';
const now = new Date('2026-10-01T12:00:00Z');
const env: InstagramEnv = {
  APP_ORIGIN: 'https://mesaaberta.app',
  INSTAGRAM_APP_ID: 'app',
  INSTAGRAM_APP_SECRET: 'secret',
  INSTAGRAM_TOKEN_KEY: Buffer.alloc(32, 7).toString('base64'),
};
let tableId: string;
let event: StoredEvent;
const render = vi.fn(async () => new Uint8Array([255, 216, 255, 217]));
const mockApi = (
  handler: (path: string, params: Record<string, string>, method: string) => unknown,
) =>
  vi.fn(async (_env, _token, path, params = {}, method = 'GET') =>
    handler(path, params, method),
  ) as unknown as typeof graph;
const api = () =>
  mockApi((path) => {
    if (path === 'ig-user/media') return { id: 'container' };
    if (path === 'container') return { status_code: 'FINISHED' };
    if (path === 'ig-user/media_publish') return { id: 'media' };
    if (path === 'media') return { permalink: 'https://www.instagram.com/p/example/' };
    throw new Error(`Unexpected request: ${path}`);
  });
const post = async () =>
  (await test.db.select().from(instagramPosts).where(eq(instagramPosts.tableId, tableId)))[0];
const run = (request = api(), time = now) =>
  publishInstagramPosts(test.db, env, time, { render, api: request });

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: gmId, username: 'mestre' });
});
afterAll(() => test.close());
beforeEach(async () => {
  vi.clearAllMocks();
  await test.db.delete(instagramPosts);
  await test.db.delete(gameTables);
  await test.db.delete(events);
  await test.db.delete(instagramAccounts);
  const [system] = await test.db.select().from(systems).limit(1);
  const [table] = await test.db
    .insert(gameTables)
    .values({
      gmId,
      systemId: system.id,
      slug: 'aventura',
      title: 'Aventura',
      kind: 'one_shot',
      capacity: 5,
      startsAt: new Date('2026-10-10T22:00:00Z'),
      timezone: 'America/Sao_Paulo',
      durationMinutes: 180,
    })
    .returning();
  tableId = table.id;
  const [stored] = await test.db
    .insert(events)
    .values({
      type: 'TableCreated',
      actorId: gmId,
      payload: { tableId, slug: table.slug, title: table.title },
      createdAt: now,
    })
    .returning();
  event = { ...stored, payload: stored.payload } as StoredEvent;
  await instagramQueueHandler.handle(event, test.db);
  await test.db
    .update(instagramPosts)
    .set({ nextAttemptAt: now })
    .where(eq(instagramPosts.tableId, tableId));
  await test.db.insert(instagramAccounts).values({
    userId: 'ig-user',
    username: 'mesaaberta',
    token: await encryptToken('token', env.INSTAGRAM_TOKEN_KEY!),
    expiresAt: new Date('2026-11-15T12:00:00Z'),
  });
});

describe('automatic Instagram publishing', () => {
  it('queues once for repeated creation events and publishes once on repeated sweeps', async () => {
    await instagramQueueHandler.handle(event, test.db);
    const request = api();
    await run(request);
    await run(request);
    expect(await test.db.select().from(instagramPosts)).toHaveLength(1);
    expect(await post()).toMatchObject({
      status: 'published',
      mediaId: 'media',
      permalink: 'https://www.instagram.com/p/example/',
      image: null,
    });
    expect(render).toHaveBeenCalledOnce();
    expect(
      vi.mocked(request).mock.calls.filter((call) => call[2].endsWith('media_publish')),
    ).toHaveLength(1);
  });
  it('keeps jobs queued while configuration or a connected account is missing', async () => {
    expect(await publishInstagramPosts(test.db, undefined, now, { render })).toBe(0);
    await test.db.delete(instagramAccounts);
    expect(await run()).toBe(0);
    expect((await post()).status).toBe('queued');
    expect(render).not.toHaveBeenCalled();
  });
  it('skips a table disabled before processing', async () => {
    await test.db.update(gameTables).set({ status: 'disabled' });
    const request = api();
    await run(request);
    expect((await post()).status).toBe('skipped');
    expect(request).not.toHaveBeenCalled();
  });
  it('reuses the container while Meta is still processing the image', async () => {
    let ready = false;
    const normal = api();
    const request = mockApi((path, params, method) =>
      path === 'container' && !ready
        ? { status_code: 'IN_PROGRESS' }
        : normal(env, 'token', path, params, method),
    );
    await run(request);
    expect(await post()).toMatchObject({
      status: 'processing',
      containerId: 'container',
      attempts: 0,
    });
    ready = true;
    await run(request, new Date(now.getTime() + 60_000));
    expect((await post()).status).toBe('published');
    expect(
      vi.mocked(request).mock.calls.filter((call) => call[2] === 'ig-user/media'),
    ).toHaveLength(1);
  });
  it('never repeats a publish whose response was lost', async () => {
    const normal = api();
    const request = mockApi((path, params, method) => {
      if (path.endsWith('media_publish')) throw new Error('timeout with secret token');
      return normal(env, 'token', path, params, method);
    });
    await run(request);
    await run(request, new Date(now.getTime() + 60_000));
    expect(await post()).toMatchObject({
      status: 'uncertain',
      lastError: 'publish_outcome_unknown',
    });
    expect(
      vi.mocked(request).mock.calls.filter((call) => call[2].endsWith('media_publish')),
    ).toHaveLength(1);
  });
  it('treats a crashed publish as uncertain without contacting Meta again', async () => {
    await test.db.update(instagramPosts).set({ status: 'publishing', containerId: 'container' });
    const request = api();
    await run(request);
    expect((await post()).status).toBe('uncertain');
    expect(request).not.toHaveBeenCalled();
  });
  it('retries only the permalink read after the media id has been saved', async () => {
    let unavailable = true;
    const normal = api();
    const request = mockApi((path, params, method) => {
      if (path === 'media' && unavailable) throw new InstagramError(500, true);
      return normal(env, 'token', path, params, method);
    });
    await run(request);
    expect(await post()).toMatchObject({ status: 'processing', mediaId: 'media', image: null });
    unavailable = false;
    await run(request, new Date(now.getTime() + 60_000));
    expect((await post()).status).toBe('published');
    expect(
      vi.mocked(request).mock.calls.filter((call) => call[2].endsWith('media_publish')),
    ).toHaveLength(1);
  });
  it('persists a definite API failure without secret error messages', async () => {
    const request = mockApi(() => {
      throw new InstagramError(190, false);
    });
    await run(request);
    expect(await post()).toMatchObject({ status: 'failed', lastError: 'api_190', image: null });
  });
  it('clears expired temporary assets even without credentials', async () => {
    await test.db
      .update(instagramPosts)
      .set({ image: 'jpeg', assetExpiresAt: now, status: 'uncertain' });
    await publishInstagramPosts(test.db, undefined, now);
    expect((await post()).image).toBeNull();
  });
});

it('keeps a manual publish pending while Meta processes and the cron completes it once', async () => {
  let ready = false;
  const normal = api();
  const request = mockApi((path, params, method) =>
    path === 'container' && !ready
      ? { status_code: 'IN_PROGRESS' }
      : normal(env, 'token', path, params, method),
  );
  expect(await publishInstagramTable(test.db, env, tableId, now, { render, api: request })).toBe(
    'processing',
  );
  expect(await post()).toMatchObject({
    status: 'processing',
    containerId: 'container',
    attempts: 0,
  });
  ready = true;
  await run(request, new Date(now.getTime() + 60_000));
  expect((await post()).status).toBe('published');
  expect(vi.mocked(request).mock.calls.filter((call) => call[2] === 'ig-user/media')).toHaveLength(
    1,
  );
  expect(
    vi.mocked(request).mock.calls.filter((call) => call[2] === 'ig-user/media_publish'),
  ).toHaveLength(1);
});
