import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listSystemDirectory } from '@mesaaberta/core/server/systems/directory';
import { load } from './+page.server';

vi.mock('@mesaaberta/core/server/systems/directory', () => ({ listSystemDirectory: vi.fn() }));

const tracked = vi.fn();
const flagged = vi.fn();
const viewer = '00000000-0000-4000-8000-000000000001';
const event = (search = '', referer = '') =>
  ({
    params: {},
    locals: {
      db: {},
      env: { SUPABASE_URL: 'https://sb.test' },
      flags: { isEnabled: flagged },
      track: tracked,
      getUser: async () => ({ id: viewer }),
      getProfile: async () => ({ id: viewer, role: 'member', status: 'active' }),
    },
    request: new Request('https://x.test/systems', { headers: referer ? { referer } : {} }),
    url: new URL(`https://x.test/systems${search}`),
  }) as unknown as RequestEvent;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape the load returns
const run = (e: RequestEvent) => (load as (e: RequestEvent) => Promise<any>)(e);

describe('the systems directory load', () => {
  beforeEach(() => {
    tracked.mockClear();
    flagged.mockReset().mockResolvedValue(true);
    vi.mocked(listSystemDirectory).mockResolvedValue({
      total: 1,
      pages: 1,
      systems: [
        {
          name: 'Tormenta 20',
          slug: 'tormenta-20',
          openTables: 3,
          totalTables: 9,
          gmCount: 2,
          gms: [{ username: 'ana', avatarPath: 'ana/a.png', avatarUrl: null }],
        },
      ],
    });
  });

  it('answers 404 while api_directory_systems is off for the person', async () => {
    flagged.mockResolvedValue(false);
    await expect(run(event())).rejects.toMatchObject({ status: 404 });
    expect(flagged).toHaveBeenCalledWith('api_directory_systems', { id: viewer, isAdmin: false });
    expect(listSystemDirectory).not.toHaveBeenCalled();
  });

  it('reads the filters from the address, junk dropped, and turns avatar paths into URLs', async () => {
    const data = await run(event('?q=%20tormenta%20&show=nope&sort=az&page=abc'));
    expect(vi.mocked(listSystemDirectory).mock.lastCall?.[1]).toEqual({
      query: 'tormenta',
      show: 'open',
      sort: 'az',
      page: 1,
    });
    expect(data.systems[0].gms).toEqual([
      {
        username: 'ana',
        avatarUrl: 'https://sb.test/storage/v1/object/public/profile-avatars/ana/a.png',
      },
    ]);
  });

  it('answers 404 for a page past the last one', async () => {
    vi.mocked(listSystemDirectory).mockResolvedValue(null);
    await expect(run(event('?page=9'))).rejects.toMatchObject({ status: 404 });
  });

  it('records the view with the number of systems found and how the person arrived', async () => {
    await run(event('?q=t', 'https://x.test/'));
    expect(tracked).toHaveBeenCalledWith('systems_directory_viewed', viewer, {
      page_context: 'search_results',
      source_channel: 'internal_link',
      result_count: 1,
    });
  });
});
