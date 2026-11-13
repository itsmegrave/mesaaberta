import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { encode as encodePng } from 'fast-png';
import { systemLogos, systems } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../../../../apps/web/src/lib/server/db/test-db';
import { IMAGE_COLUMNS, picturesToConvert, runImageBackfill } from './image-backfill';
import { logger } from './logger';

let test: Awaited<ReturnType<typeof createTestDb>>;

const PNG = encodePng({
  width: 64,
  height: 64,
  data: new Uint8Array(64 * 64 * 4).fill(200),
  channels: 4,
  depth: 8,
});
const upload = vi.fn(async () => ({ error: null as { message: string } | null }));
const storage = () => ({ upload, remove: vi.fn(async () => ({ error: null })) });
const env = { DATABASE_URL: 'postgres://test', SUPABASE_URL: 'https://storage.test' };
const fetcher = vi.fn(async () => new Response(PNG));

const run = (overrides: Partial<typeof env & { IMAGE_BACKFILL: string }> = {}) =>
  runImageBackfill(
    { ...env, ...overrides },
    {
      log: logger,
      open: () => ({ db: test.db, close: async () => undefined }) as never,
      storage,
      fetcher: fetcher as unknown as typeof fetch,
    },
  );

const logoPaths = async () =>
  (await test.db.select({ path: systemLogos.path }).from(systemLogos)).map((r) => r.path).sort();

beforeAll(async () => {
  test = await createTestDb();
});

afterAll(() => test?.close());

beforeEach(async () => {
  upload.mockClear();
  fetcher.mockClear();
  await test.db.delete(systemLogos);
  await test.db.delete(systems);
  const [a, b] = await test.db
    .insert(systems)
    .values([
      { name: 'Daggerheart', slug: 'daggerheart', position: 1 },
      { name: 'Tormenta', slug: 'tormenta', position: 2 },
    ])
    .returning({ id: systems.id });
  await test.db.insert(systemLogos).values([
    { systemId: a!.id, status: 'approved', path: 'systems/a.png' },
    { systemId: b!.id, status: 'approved', path: 'systems/b.webp' },
  ]);
});

describe('runImageBackfill', () => {
  it('stores a PNG again as WebP and points the row at it', async () => {
    expect(await run()).toEqual({ converted: 1, failed: 0 });

    expect(fetcher).toHaveBeenCalledWith(
      'https://storage.test/storage/v1/object/public/table-images/systems/a.png',
      expect.anything(),
    );
    expect(upload).toHaveBeenCalledWith('systems/a.webp', expect.any(Uint8Array), {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '86400',
    });
    expect(await logoPaths()).toEqual(['systems/a.webp', 'systems/b.webp']);
  });

  it('has nothing left to do once every picture is WebP', async () => {
    await run();
    upload.mockClear();
    expect(await run()).toEqual({ converted: 0, failed: 0 });
    expect(upload).not.toHaveBeenCalled();
  });

  it('leaves the row alone when Storage refuses the new file, so the next run tries again', async () => {
    upload.mockResolvedValueOnce({ error: { message: 'bucket not found' } });
    expect(await run()).toEqual({ converted: 0, failed: 1 });
    expect(await logoPaths()).toEqual(['systems/a.png', 'systems/b.webp']);
  });

  it('does nothing with the kill switch off', async () => {
    expect(await run({ IMAGE_BACKFILL: 'off' })).toEqual({ converted: 0, failed: 0 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('picturesToConvert', () => {
  it('reads every picture column there is, so none is forgotten', async () => {
    // Every listed column exists: a typo would make this query fail.
    await expect(picturesToConvert(test.db as never, 50)).resolves.toBeDefined();
    expect(IMAGE_COLUMNS.length).toBeGreaterThan(0);
  });

  it("skips a tool's seeded logo, which ships with the site", async () => {
    await test.db
      .update(systemLogos)
      .set({ path: '/tools/foundry.png' })
      .where(eq(systemLogos.path, 'systems/a.png'));
    expect(await picturesToConvert(test.db as never, 50)).toEqual([]);
  });
});
