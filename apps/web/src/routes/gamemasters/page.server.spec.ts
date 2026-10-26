import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gmDirectorySystems, listGmDirectory } from '@mesaaberta/core/server/gms/directory';
import { load } from './+page.server';

vi.mock('@mesaaberta/core/server/gms/directory', () => ({
  listGmDirectory: vi.fn(),
  gmDirectorySystems: vi.fn(),
}));

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
    request: new Request('https://x.test/gamemasters', { headers: referer ? { referer } : {} }),
    url: new URL(`https://x.test/gamemasters${search}`),
  }) as unknown as RequestEvent;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape the load returns
const run = (e: RequestEvent) => (load as (e: RequestEvent) => Promise<any>)(e);

const ana = {
  username: 'ana',
  name: 'Ana',
  avatarPath: 'ana/a.png',
  avatarUrl: null,
  bio: null,
  tableRole: 'gm' as const,
  rating: { score: 4.8, count: 12, isNew: false },
  badges: null,
  tables: 5,
  lastRunAt: null,
  openTables: 1,
  systems: [],
  moreSystems: 0,
  modalities: [],
  city: null,
};

describe('the Quem mestra load', () => {
  beforeEach(() => {
    tracked.mockClear();
    flagged.mockReset().mockResolvedValue(true);
    vi.mocked(listGmDirectory).mockResolvedValue({ total: 1, pages: 1, people: [ana] });
    vi.mocked(gmDirectorySystems).mockResolvedValue([{ name: 'D&D', slug: 'dnd' }]);
  });

  it('answers 404 while api_directory_gms is off for the person', async () => {
    flagged.mockImplementation(async (name: string) => name !== 'api_directory_gms');
    await expect(run(event())).rejects.toMatchObject({ status: 404 });
    expect(flagged).toHaveBeenCalledWith('api_directory_gms', { id: viewer, isAdmin: false });
    expect(listGmDirectory).not.toHaveBeenCalled();
  });

  it('reads the filters from the address, shows badges by use_badges, and turns avatar paths into URLs', async () => {
    const data = await run(event('?q=%40ana&modality=mars&open=1&page=abc'));
    const [, filters, , options] = vi.mocked(listGmDirectory).mock.lastCall!;
    expect(filters).toEqual({
      query: 'ana',
      system: '',
      modality: '',
      open: true,
      sort: 'recent',
      page: 1,
    });
    expect(options).toEqual({ showBadges: true });
    expect(flagged).toHaveBeenCalledWith('use_badges', { id: viewer, isAdmin: false });
    expect(data.systems).toEqual([{ name: 'D&D', slug: 'dnd' }]);
    expect(data.people[0]).not.toHaveProperty('avatarPath');
    expect(data.people[0].avatarUrl).toBe(
      'https://sb.test/storage/v1/object/public/profile-avatars/ana/a.png',
    );
  });

  it('is a public page: a visitor sees it, the flag read for nobody in particular', async () => {
    const visitor = event();
    Object.assign(visitor.locals, { getUser: async () => null, getProfile: async () => null });
    const data = await run(visitor);
    expect(data.people).toHaveLength(1);
    expect(flagged).toHaveBeenCalledWith('api_directory_gms', {});
    expect(flagged).toHaveBeenCalledWith('use_badges', {});
  });

  it('answers 404 for a page past the last one', async () => {
    vi.mocked(listGmDirectory).mockResolvedValue(null);
    await expect(run(event('?page=9'))).rejects.toMatchObject({ status: 404 });
  });

  it('records the view with the number of people found and how the person arrived', async () => {
    await run(event('?system=dnd', 'https://x.test/'));
    expect(tracked).toHaveBeenCalledWith('gm_directory_viewed', viewer, {
      page_context: 'filtered',
      source_channel: 'internal_link',
      result_count: 1,
    });
  });
});
