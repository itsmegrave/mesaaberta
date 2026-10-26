import { describe, expect, it } from 'vitest';
import { NO_FILTERS, placeDirectoryQuery, readPlaceFilters, tagHref } from './filters';

const read = (query: string) => readPlaceFilters(new URLSearchParams(query));

describe('the Onde jogar filters', () => {
  it('reads every filter from the address', () => {
    expect(
      read(
        'q=+Dragão+&state=PE&city=pe-recife&kind=game-cafe&amenity=free-to-play&amenity=accessible&sort=name&page=2',
      ),
    ).toEqual({
      query: 'Dragão',
      state: 'pe',
      city: 'pe-recife',
      kind: 'game_cafe',
      amenities: ['accessible', 'free_to_play'],
      sort: 'name',
      page: 2,
    });
  });

  it('drops what it does not know, and a city outside the state', () => {
    expect(read('state=pernambuco&city=pe-recife&kind=castle&amenity=wifi&sort=x&page=-1')).toEqual(
      { ...NO_FILTERS, page: 1 },
    );
    expect(read('state=sp&city=pe-recife').city).toBe('');
    expect(read('city=pe-recife').city).toBe('');
  });

  it('writes one address per list, defaults left out', () => {
    expect(placeDirectoryQuery(NO_FILTERS)).toBe('');
    const query = placeDirectoryQuery(
      { ...NO_FILTERS, state: 'pe', city: 'pe-recife', amenities: ['free_to_play', 'accessible'] },
      3,
    );
    expect(query).toBe('?state=pe&city=pe-recife&amenity=accessible&amenity=free-to-play&page=3');
    expect(read(query.slice(1))).toMatchObject({
      amenities: ['accessible', 'free_to_play'],
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
    expect(tagHref({ kind: 'amenity', slug: 'free-to-play' }, tags)).toBe(
      '/places?amenity=free-to-play',
    );
  });
});
