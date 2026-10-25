import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { instagramAsset } from './asset';
import { gameTables, instagramPosts, profiles, systems } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../../../../apps/web/src/lib/server/db/test-db';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gmId = '00000000-0000-4000-8000-000000001201';
const key = '11111111-1111-4111-8111-111111111111';
const jpeg = [255, 216, 255, 217];
let tableId: string;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: gmId, username: 'mestre' });
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(instagramPosts);
  await test.db.delete(gameTables);
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
});

const post = (over: Partial<typeof instagramPosts.$inferInsert> = {}) =>
  test.db.insert(instagramPosts).values({
    tableId,
    eventId: '00000000-0000-4000-8000-000000000001',
    assetKey: key,
    image: btoa(String.fromCharCode(...jpeg)),
    assetExpiresAt: new Date(Date.now() + 60_000),
    ...over,
  });

describe('the Instagram share image', () => {
  it('is the post’s JPEG while its key has not expired', async () => {
    await post();

    const asset = await instagramAsset(test.db, key);

    expect(asset?.type).toBe('image/jpeg');
    expect([...asset!.body]).toEqual(jpeg);
  });

  it('is nothing once expired, cleared, unknown or not a key', async () => {
    await post({ assetExpiresAt: new Date(Date.now() - 1000) });
    expect(await instagramAsset(test.db, key)).toBeNull();

    await test.db.delete(instagramPosts);
    await post({ image: null });
    expect(await instagramAsset(test.db, key)).toBeNull();
    expect(await instagramAsset(test.db, '22222222-2222-4222-8222-222222222222')).toBeNull();
    expect(await instagramAsset(test.db, 'not-a-key')).toBeNull();
  });
});
