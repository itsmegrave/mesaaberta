import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../../db/test-db';
import { runDailyImports } from './runner';
import type { SourceAdapter } from './types';
import type { createDb } from '../../db/client';
import { logger } from '../../logger';
let test: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  test = await createTestDb();
});
afterAll(async () => test.close());
const now = new Date('2026-10-08T04:00:00Z');
const env = { DATABASE_URL: 'test', CROWDFUNDING_IMPORT_ENABLED: 'true' };
const candidate = {
  source: 'catarse' as const,
  externalId: 'runner',
  url: 'https://catarse.com.br/runner',
  name: 'Livro RPG',
  owner: 'Editora',
  startsOn: '2026-10-01',
  endsOn: '2026-11-01',
  imageUrl: null,
};
const close = vi.fn(async () => {});
const open = (() => ({ db: test.db, close })) as unknown as typeof createDb;
const readFor = () => async () => '';
describe('daily source isolation and checkpointing', () => {
  it('does no fetching when disabled or without database configuration', async () => {
    const list = vi.fn();
    expect(
      await runDailyImports(
        {},
        {
          scheduledTime: +now,
          log: logger,
          sources: [{ source: 'catarse', list, detail: vi.fn() }],
          open,
          readFor,
        },
      ),
    ).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });
  it('imports the healthy source even when the other returns a blocked page and closes the connection', async () => {
    const good: SourceAdapter = {
      source: 'catarse',
      list: async () => ({ urls: [candidate.url], nextPage: null }),
      detail: async () => candidate,
    };
    const bad: SourceAdapter = {
      source: 'meeplestarter',
      list: async () => {
        throw new Error('source_http_403');
      },
      detail: vi.fn(),
    };
    const result = await runDailyImports(env, {
      scheduledTime: +now,
      log: logger,
      sources: [bad, good],
      open,
      readFor,
    });
    expect(result.map((r) => r.status)).toEqual(['failed', 'complete']);
    expect(result[1].imported).toBe(1);
    expect(close).toHaveBeenCalled();
    expect(
      await runDailyImports(env, {
        scheduledTime: +now,
        log: logger,
        sources: [good, bad],
        open,
        readFor,
      }),
    ).toEqual([]);
  });
  it('resumes capped discovery the next day without dropping remaining candidates', async () => {
    const list = vi.fn(async () => ({
      urls: ['https://catarse.com.br/page-a', 'https://catarse.com.br/page-b'],
      nextPage: null,
    }));
    const detail = vi.fn(async (url: string) => ({
      ...candidate,
      url,
      externalId: url.split('/').pop()!,
    }));
    const source: SourceAdapter = { source: 'catarse', list, detail };
    const opts = { log: logger, sources: [source], open, readFor, maxDetails: 1 };
    expect(
      (await runDailyImports(env, { ...opts, scheduledTime: +now + 86400_000 }))[0],
    ).toMatchObject({ status: 'partial', imported: 1 });
    expect(
      (await runDailyImports(env, { ...opts, scheduledTime: +now + 2 * 86400_000 }))[0],
    ).toMatchObject({ status: 'complete', imported: 1 });
    expect(detail.mock.calls.map((c) => c[0])).toEqual([
      'https://catarse.com.br/page-a',
      'https://catarse.com.br/page-b',
    ]);
  });
});
