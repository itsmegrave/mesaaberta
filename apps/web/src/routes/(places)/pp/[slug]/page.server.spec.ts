import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readPlacePage } from '@mesaaberta/core/server/places/directory';
import { actorsOnly, apiOver } from '#lib/server/db/test-api.js';
import { load } from './+page.server';

vi.mock('@mesaaberta/core/server/places/directory', () => ({ readPlacePage: vi.fn() }));

const flagged = vi.fn();
const logged = vi.fn();
const viewer = '00000000-0000-4000-8000-000000000001';
const event = (role = 'member') =>
  ({
    params: { slug: 'taverna' },
    locals: {
      // The api answers over the mocked reader; the stand-in database only names the viewer.
      env: apiOver(actorsOnly([{ id: viewer, role, status: 'active' }]), {
        SUPABASE_URL: 'https://sb.test',
      }),
      flags: { isEnabled: flagged },
      log: { info: logged, warn: vi.fn() },
      getUser: async () => ({ id: viewer }),
      getProfile: async () => ({ id: viewer, role, status: 'active' }),
    },
    request: new Request('https://x.test/pp/taverna'),
    url: new URL('https://x.test/pp/taverna'),
  }) as unknown as RequestEvent;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape the load returns
const run = (e: RequestEvent) => (load as (e: RequestEvent) => Promise<any>)(e);

const page = {
  place: { slug: 'taverna', name: 'Taverna do Dado', imagePath: 'places/t.png' },
  links: [],
  tags: [],
  tables: [{ slug: 'mesa', imagePath: null }],
  openTables: 1,
  pending: false,
  hidden: false,
  canEdit: false,
  owner: false,
  claimable: true,
  canReport: true,
  partner: { id: 'p1', name: 'Loja do Dado' },
  gms: {
    total: 1,
    people: [
      {
        username: 'ana',
        name: null,
        avatarPath: 'ana/a.png',
        avatarUrl: null,
        house: true,
        tables: 2,
      },
    ],
  },
  systems: [{ name: 'D&D', slug: 'dnd', tables: 2 }],
};

describe("a place's page load", () => {
  beforeEach(() => {
    flagged.mockReset().mockResolvedValue(true);
    logged.mockClear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a partial page is enough here
    vi.mocked(readPlacePage).mockResolvedValue(page as any);
  });

  it('answers 404 while api_directory_places is off for the person', async () => {
    flagged.mockImplementation(async (name: string) => name !== 'api_directory_places');
    await expect(run(event())).rejects.toMatchObject({ status: 404 });
    expect(readPlacePage).not.toHaveBeenCalled();
  });

  it('reads the place for who is looking, with image URLs', async () => {
    const data = await run(event('admin'));
    expect(vi.mocked(readPlacePage).mock.lastCall?.slice(1, 3)).toEqual([
      'taverna',
      { id: viewer, isAdmin: true },
    ]);
    expect(data.place).not.toHaveProperty('imagePath');
    expect(data.place.imageUrl).toContain('places/t.png');
    expect(data.tables[0]).toEqual({ slug: 'mesa', imageUrl: null });
    expect(data.partner).toEqual({ id: 'p1', name: 'Loja do Dado' });
    expect(data.gms.people[0]).not.toHaveProperty('avatarPath');
    expect(data.gms.people[0].avatarUrl).toContain('ana/a.png');
    expect(data.systems).toHaveLength(1);
  });

  it('leaves out the partner, Quem mestra aqui and the systems while use_directory_links is off', async () => {
    flagged.mockImplementation(async (name: string) => name !== 'use_directory_links');
    const data = await run(event());
    expect(data.partner).toBeNull();
    expect(data.gms).toEqual({ total: 0, people: [] });
    expect(data.systems).toEqual([]);
  });

  it('answers 404 for a place nobody may see, and logs it', async () => {
    vi.mocked(readPlacePage).mockResolvedValue(null);
    await expect(run(event())).rejects.toMatchObject({ status: 404 });
    expect(logged).toHaveBeenCalledWith('place not found', { code: 'place_not_found' });
  });
});
