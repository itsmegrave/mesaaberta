import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { systemLogos, systems } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../../../../../../apps/web/src/lib/server/db/test-db';
import { logger } from '../../logger';
import { runLogoSearch, searchRecord } from './background';
import type { LogoSearch } from './finder';

let test: Awaited<ReturnType<typeof createTestDb>>;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const upload = vi.fn(async () => ({ error: null }));
const remove = vi.fn(async () => ({ error: null }));
const storage = { upload, remove };
const env = { DATABASE_URL: 'postgres://test' };
const finder = {
  // The picture's host answers the PNG; DNS is public.
  fetcher: async () => new Response(PNG, { headers: { 'content-type': 'image/png' } }),
  resolve: async () => ['93.184.216.34'],
};
const candidate = {
  imageUrl: 'https://upload.wikimedia.org/dh.png',
  sourcePage: 'https://commons.wikimedia.org/wiki/File:DH.svg',
  method: 'wikidata' as const,
  confidence: 'high' as const,
  attribution: 'Darrington Press',
  license: 'Public domain',
  note: 'nota',
};
const hit: LogoSearch = { candidate, wikidataId: 'Q2', website: null, reason: null };
const none: LogoSearch = {
  candidate: null,
  wikidataId: null,
  website: null,
  reason: 'no_wikidata_item',
};

const run = (find: (name: string) => Promise<LogoSearch>, batch = 10) =>
  runLogoSearch(env, {
    log: logger,
    open: () => ({ db: test.db, close: async () => undefined }) as never,
    find,
    storage,
    finder,
    batch,
  });

beforeAll(async () => {
  test = await createTestDb();
  await test.db.delete(systems);
  await test.db.insert(systems).values([
    { name: 'Daggerheart', slug: 'daggerheart', position: 1 },
    { name: 'Sistema Caseiro', slug: 'caseiro', position: 2 },
    { name: 'Tormenta', slug: 'tormenta', position: 3 },
  ]);
});

afterAll(() => test?.close());

beforeEach(() => {
  upload.mockClear();
  remove.mockClear();
});

describe('runLogoSearch', () => {
  it('stores what it finds as pending, records the rest as missing, a batch at a time', async () => {
    const find = vi.fn(async (name: string) => (name === 'Daggerheart' ? hit : none));

    expect(await run(find, 2)).toEqual({ searched: 2, found: 1 });

    const rows = await test.db.select().from(systemLogos);
    expect(rows.map((row) => [row.status, row.method]).sort()).toEqual([
      ['missing', null],
      ['pending', 'wikidata'],
    ]);
    const [path] = upload.mock.calls[0] as unknown as [string];
    expect(path).toMatch(/^systems\/[0-9a-f-]{36}\.png$/);
    expect(rows.find((row) => row.status === 'pending')?.path).toBe(path);
  });

  it('stops without recording when Wikidata does not answer, so the next run tries again', async () => {
    const find = vi.fn(async (): Promise<LogoSearch> => ({
      ...none,
      reason: 'lookup_failed',
      retryAfter: 60,
    }));

    expect(await run(find)).toEqual({ searched: 0, found: 0 });
    expect(find).toHaveBeenCalledOnce();
    expect(await test.db.select().from(systemLogos)).toHaveLength(2);
  });

  it('searches the rest on the next run, and does nothing once none is left', async () => {
    expect(await run(async () => none)).toEqual({ searched: 1, found: 0 });
    const find = vi.fn(async () => none);
    expect(await run(find)).toEqual({ searched: 0, found: 0 });
    expect(find).not.toHaveBeenCalled();
  });

  it('is off with LOGO_SEARCH=off, and without storage', async () => {
    const find = vi.fn(async () => none);
    expect(
      await runLogoSearch({ ...env, LOGO_SEARCH: 'off' }, { log: logger, find, storage }),
    ).toEqual({ searched: 0, found: 0 });
    expect(await runLogoSearch(env, { log: logger, find, storage: null })).toEqual({
      searched: 0,
      found: 0,
    });
    expect(find).not.toHaveBeenCalled();
  });
});

describe('searchRecord', () => {
  it('records a picture it could not read as missing, with why', () => {
    expect(searchRecord('s1', hit, null)).toEqual({
      systemId: 's1',
      found: null,
      reason: `image_unreadable: ${candidate.imageUrl}`,
      wikidataId: 'Q2',
    });
  });
});
