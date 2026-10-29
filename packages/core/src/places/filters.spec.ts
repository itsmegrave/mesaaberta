import { describe, expect, it } from 'vitest';
import { NO_FILTERS, placeDirectoryQuery, readPlaceFilters, tagHref } from './filters';

const read = (query: string) => readPlaceFilters(new URLSearchParams(query));

describe('the Onde jogar filters', () => {
  it('reads every filter from the address', () => {
    expect(
      read(
        'q=+Dragão+&state=PE&city=pe-recife&kind=game-cafe&tag=rpg&tag=free-to-play&amenity=accessible&sort=name&page=2',
      ),
    ).toEqual({
      query: 'Dragão',
      state: 'pe',
      city: 'pe-recife',
      kind: 'game_cafe',
      // `amenity` is the old address of the first tags: it still filters.
      tags: ['accessible', 'free-to-play', 'rpg'],
      sort: 'name',
      page: 2,
    });
  });

  it('takes at most ten tags, each once', () => {
    const many = Array.from({ length: 12 }, (_, i) => `tag=t${String(i).padStart(2, '0')}`);
    expect(read([...many, 'tag=t00'].join('&')).tags).toHaveLength(10);
  });

  it('drops what it does not know, and a city outside the state', () => {
    expect(
      read('state=pernambuco&city=pe-recife&kind=castle&tag=Not+a+slug!&sort=x&page=-1'),
    ).toEqual({ ...NO_FILTERS, page: 1 });
    expect(read('state=sp&city=pe-recife').city).toBe('');
    expect(read('city=pe-recife').city).toBe('');
  });

  it('writes one address per list, defaults left out', () => {
    expect(placeDirectoryQuery(NO_FILTERS)).toBe('');
    const query = placeDirectoryQuery(
      { ...NO_FILTERS, state: 'pe', city: 'pe-recife', tags: ['free-to-play', 'accessible'] },
      3,
    );
    expect(query).toBe('?state=pe&city=pe-recife&tag=accessible&tag=free-to-play&page=3');
    expect(read(query.slice(1))).toMatchObject({
      tags: ['accessible', 'free-to-play'],
      page: 3,
    });
  });

  it('links each tag to the list it stands for; a neighbourhood to its city', () => {
    const tags = [
      { kind: 'state', slug: 'pe' },
      { kind: 'city', slug: 'pe-recife' },
      { kind: 'neighbourhood', slug: 'pe-recife-boa-viagem' },
    ];
    expect(tagHref(tags[0], tags)).toBe('/places?state=pe');
    expect(tagHref(tags[1], tags)).toBe('/places?state=pe&city=pe-recife');
    expect(tagHref(tags[2], tags)).toBe('/places?state=pe&city=pe-recife');
    expect(tagHref({ kind: 'kind', slug: 'game-cafe' }, tags)).toBe('/places?kind=game-cafe');
    expect(tagHref({ kind: 'feature', slug: 'free-to-play' }, tags)).toBe(
      '/places?tag=free-to-play',
    );
  });
});
