import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listSystems } from '$lib/server/systems';
import { listUpcomingTables } from '$lib/server/tables/queries';
import { load } from './+page.server';

vi.mock('$lib/server/tables/queries', () => ({ listUpcomingTables: vi.fn() }));
vi.mock('$lib/server/systems', () => ({ listSystems: vi.fn() }));
vi.mock('$lib/server/catalog', () => ({
  listCatalog: vi.fn(async () => ({
    platforms: [{ name: 'Discord', slug: 'discord' }],
    tags: [{ name: 'Terror', slug: 'terror' }],
  })),
}));

type Table = Awaited<ReturnType<typeof listUpcomingTables>>[number];
type System = Awaited<ReturnType<typeof listSystems>>[number];

const system = (slug: string) => ({ slug, name: slug.toUpperCase() }) as System;
const table = (slug: string, systemSlug: string) =>
  ({
    slug,
    gmId: 'gm',
    imagePath: null,
    system: { slug: systemSlug, name: '' },
    platforms: slug === 't3' ? [{ name: 'Discord', slug: 'discord' }] : [],
    tags: slug === 't1' ? [{ name: 'Terror', slug: 'terror' }] : [],
  }) as unknown as Table;

// Catalogue order: a, b, c, d, e.
const catalogue = ['a', 'b', 'c', 'd', 'e'].map(system);

const tracked = vi.fn();
const viewer = '00000000-0000-4000-8000-000000000001';
const event = (search = '', referer = '') =>
  ({
    params: {},
    locals: { db: {}, track: tracked, getUser: async () => ({ id: viewer }) },
    request: new Request('https://x.test/tables', { headers: referer ? { referer } : {} }),
    url: new URL(`https://x.test/tables${search}`),
    platform: undefined,
  }) as unknown as RequestEvent;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape the load returns
const run = (e: RequestEvent) => (load as (e: RequestEvent) => Promise<any>)(e);
const slugs = (list: { slug: string }[]) => list.map((item) => item.slug);

describe('the table list load', () => {
  beforeEach(() => {
    tracked.mockClear();
    vi.mocked(listSystems).mockResolvedValue(catalogue);
    vi.mocked(listUpcomingTables).mockResolvedValue([
      table('t1', 'd'),
      table('t2', 'd'),
      table('t3', 'c'),
    ]);
  });

  it('lists the systems with the most tables first, then the catalogue order', async () => {
    const data = await run(event());

    expect(slugs(data.systems)).toEqual(['d', 'c', 'a', 'b', 'e']);
    expect(slugs(data.tables)).toEqual(['t1', 't2', 't3']);
    expect(data.tables[0]).not.toHaveProperty('gmId');
  });

  it('narrows the list to the chosen system', async () => {
    const data = await run(event('?system=c'));

    expect(data.pickedSystems).toEqual(['c']);
    expect(slugs(data.tables)).toEqual(['t3']);
  });

  it('shows no table for a system nobody runs', async () => {
    const data = await run(event('?system=e'));

    expect(data.pickedSystems).toEqual(['e']);
    expect(data.tables).toEqual([]);
  });

  it('takes several systems, platforms and tags from the query string, any of each', async () => {
    expect(slugs((await run(event('?system=c&system=d'))).tables)).toEqual(['t1', 't2', 't3']);
    expect(slugs((await run(event('?platform=discord'))).tables)).toEqual(['t3']);
    expect(slugs((await run(event('?tag=terror&tag=humor'))).tables)).toEqual(['t1']);
    // Across groups, a table has to match both.
    expect(slugs((await run(event('?tag=terror&platform=discord'))).tables)).toEqual([]);
  });

  it('records a browse view for the signed-in viewer, with where they came from and no table text', async () => {
    await run(event('', 'https://x.test/'));
    await run(event('?system=d', 'https://elsewhere.test/'));

    expect(tracked).toHaveBeenNthCalledWith(1, 'player_browse_mesas_viewed', viewer, {
      page_context: 'browse_feed',
      source_channel: 'internal_link',
      result_count: 3,
    });
    expect(tracked).toHaveBeenNthCalledWith(2, 'player_browse_mesas_viewed', viewer, {
      page_context: 'search_results',
      source_channel: 'referral',
      result_count: 2,
    });
  });
});
