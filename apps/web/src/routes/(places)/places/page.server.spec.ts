import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listPlaces } from '@mesaaberta/core/server/places/directory';
import { load } from './+page.server';

vi.mock('@mesaaberta/core/server/places/directory', () => ({ listPlaces: vi.fn() }));

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
    request: new Request('https://x.test/places', { headers: referer ? { referer } : {} }),
    url: new URL(`https://x.test/places${search}`),
  }) as unknown as RequestEvent;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the tests read whatever shape the load returns
const run = (e: RequestEvent) => (load as (e: RequestEvent) => Promise<any>)(e);

const taverna = {
  slug: 'taverna',
  name: 'Taverna do Dado',
  kind: 'game_cafe' as const,
  neighbourhood: 'Boa Viagem',
  city: 'Recife',
  state: 'PE',
  description: null,
  amenities: [],
  imagePath: 'places/t.png',
  openTables: 2,
};

describe('the Onde jogar load', () => {
  beforeEach(() => {
    tracked.mockClear();
    flagged.mockReset().mockResolvedValue(true);
    vi.mocked(listPlaces).mockResolvedValue({
      total: 1,
      pages: 1,
      states: [{ slug: 'pe', label: 'PE' }],
      cities: [],
      places: [taverna],
    });
  });

  it('answers 404 while api_directory_places is off for the person', async () => {
    flagged.mockImplementation(async (name: string) => name !== 'api_directory_places');
    await expect(run(event())).rejects.toMatchObject({ status: 404 });
    expect(flagged).toHaveBeenCalledWith('api_directory_places', { id: viewer, isAdmin: false });
    expect(listPlaces).not.toHaveBeenCalled();
  });

  it('reads the filters from the address and turns image paths into URLs', async () => {
    const data = await run(event('?state=PE&kind=bar&amenity=wifi&page=abc'));
    const [, filters] = vi.mocked(listPlaces).mock.lastCall!;
    expect(filters).toMatchObject({ state: 'pe', kind: 'bar', amenities: [], page: 1 });
    expect(data.places[0]).not.toHaveProperty('imagePath');
    expect(data.places[0].imageUrl).toContain('places/t.png');
  });

  it('is a public page: a visitor sees it', async () => {
    const visitor = event();
    Object.assign(visitor.locals, { getUser: async () => null, getProfile: async () => null });
    expect((await run(visitor)).places).toHaveLength(1);
    expect(flagged).toHaveBeenCalledWith('api_directory_places', {});
  });

  it('answers 404 for a page past the last one', async () => {
    vi.mocked(listPlaces).mockResolvedValue(null);
    await expect(run(event('?page=9'))).rejects.toMatchObject({ status: 404 });
  });

  it('records the view with the number of places found and how the person arrived', async () => {
    await run(event('?state=pe', 'https://x.test/'));
    expect(tracked).toHaveBeenCalledWith('places_directory_viewed', viewer, {
      page_context: 'filtered',
      source_channel: 'internal_link',
      result_count: 1,
    });
  });
});
