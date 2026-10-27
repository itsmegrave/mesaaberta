import type { RequestEvent } from '@sveltejs/kit';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '#lib/server/db/test-db.js';
import { actorsOnly, apiOver } from '#lib/server/db/test-api.js';
import { listNewTables, listUpcomingTables } from '@mesaaberta/core/server/tables/queries';
import { readHome } from '@mesaaberta/core/server/reads/home';
import { load } from './+page.server';

vi.mock('@mesaaberta/core/server/reads/home', () => ({ readHome: vi.fn() }));

vi.mock('@mesaaberta/core/server/tables/queries', () => ({
  listUpcomingTables: vi.fn(),
  listNewTables: vi.fn(),
}));

const listed = vi.mocked(listUpcomingTables);
const fresh = vi.mocked(listNewTables);

const table = (n: number) =>
  ({
    slug: `mesa-${n}`,
    title: `Mesa ${n}`,
    gmId: `gm-${n}`,
    imagePath: null,
  }) as unknown as Awaited<ReturnType<typeof listUpcomingTables>>[number];

let test: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  test = await createTestDb();
});
afterAll(() => test.close());

const error = vi.fn();
// A visitor: the api Worker reads the preview (over the test database; the queries are mocked).
// `api: false` is a web Worker with no api to call.
const event = ({ api = true } = {}) =>
  ({
    params: {},
    url: new URL('https://x.test/'),
    locals: {
      env: api ? apiOver(test.db) : {},
      log: { error, warn: vi.fn() },
      getUser: async () => null,
      getProfile: async () => null,
    },
    platform: undefined,
  }) as unknown as RequestEvent;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape the load returns
const run = (e: RequestEvent) => (load as (e: RequestEvent) => Promise<any>)(e);

describe('the home page load', () => {
  beforeEach(() => {
    listed.mockReset();
    fresh.mockReset();
    fresh.mockResolvedValue([]);
    error.mockReset();
  });

  it('lists nothing when there is no api to read from', async () => {
    expect(await run(event({ api: false }))).toMatchObject({
      tables: [],
      newTables: [],
      readSeed: { resource: 'preview', viewer: 'public', fields: ['tables', 'newTables', 'now'] },
    });
    expect(listed).not.toHaveBeenCalled();
  });

  it('previews the ten soonest tables, keeping the GM id on the server', async () => {
    listed.mockResolvedValue(Array.from({ length: 10 }, (_, i) => table(i + 1)));

    const { tables } = await run(event());

    // The query reads only the ten it shows; it no longer loads every upcoming table to slice.
    expect(listed).toHaveBeenCalledWith(expect.anything(), expect.any(Date), { limit: 10 });
    expect(tables).toHaveLength(10);
    expect(tables[9].slug).toBe('mesa-10');
    expect(tables[0]).not.toHaveProperty('gmId');
    expect(tables[0]).not.toHaveProperty('imagePath');
  });

  it('lists the new tables apart, with the instant they were read at', async () => {
    listed.mockResolvedValue([table(1)]);
    fresh.mockResolvedValue([table(1), table(2)]);

    const { newTables, now } = await run(event());

    expect(newTables.map((t: { slug: string }) => t.slug)).toEqual(['mesa-1', 'mesa-2']);
    expect(newTables[0]).not.toHaveProperty('gmId');
    expect(now).toBeInstanceOf(Date);
    expect(fresh).toHaveBeenCalledWith(expect.anything(), now, 10);
  });

  it('still renders, without the preview, when the tables cannot be listed', async () => {
    listed.mockRejectedValue(new Error('down'));

    expect(await run(event())).toMatchObject({
      tables: [],
      newTables: [],
      readSeed: { resource: 'preview', viewer: 'public', fields: ['tables', 'newTables', 'now'] },
    });
    expect(error).toHaveBeenCalledOnce();
  });

  it('gives a member with use_signed_in_home their Início instead of the landing page', async () => {
    vi.mocked(readHome).mockResolvedValue({
      rows: { followed: null, systems: [], fresh: [] },
      account: { newestReview: null },
      suggestions: [],
    } as never);
    const member = {
      params: {},
      url: new URL('https://x.test/'),
      locals: {
        log: { error, warn: vi.fn() },
        env: apiOver(actorsOnly([{ id: 'me', role: 'member', status: 'active' }])),
        flags: { isEnabled: async (name: string) => name === 'use_signed_in_home' },
        getUser: async () => ({ id: 'me' }),
        getProfile: async () => ({ id: 'me', username: 'eu', name: null, role: 'member' }),
      },
      platform: undefined,
    } as unknown as RequestEvent;

    const data = await run(member);

    expect(data).toMatchObject({ signedInHome: true, name: 'eu', readSeed: { resource: 'home' } });
    expect(readHome).toHaveBeenCalledWith(expect.anything(), 'me', expect.any(Date), {
      follows: false,
    });
    expect(listed).not.toHaveBeenCalled();
  });
});
