import { describe, expect, it } from 'vitest';
import { placeTags } from './tags';

describe('placeTags', () => {
  it('tags the address, the kind and each amenity in the list order', () => {
    expect(
      placeTags({
        state: 'PE',
        city: 'Recife',
        neighbourhood: 'Boa Viagem',
        kind: 'game_cafe',
        amenities: ['free_to_play', 'accessible'],
      }),
    ).toEqual([
      { kind: 'state', label: 'PE', slug: 'pe' },
      { kind: 'city', label: 'Recife', slug: 'pe-recife' },
      { kind: 'neighbourhood', label: 'Boa Viagem', slug: 'pe-recife-boa-viagem' },
      { kind: 'kind', label: 'game_cafe', slug: 'game-cafe' },
      { kind: 'amenity', label: 'accessible', slug: 'accessible' },
      { kind: 'amenity', label: 'free_to_play', slug: 'free-to-play' },
    ]);
  });

  it('leaves the neighbourhood out when the CEP has none, and keeps two cities apart', () => {
    const centro = (city: string) =>
      placeTags({ state: 'SP', city, neighbourhood: 'Centro', kind: 'store', amenities: [] });
    expect(centro('São Paulo').find((tag) => tag.kind === 'neighbourhood')?.slug).toBe(
      'sp-sao-paulo-centro',
    );
    expect(centro('Santos').find((tag) => tag.kind === 'neighbourhood')?.slug).toBe(
      'sp-santos-centro',
    );
    expect(
      placeTags({ state: 'SP', city: 'Santos', neighbourhood: null, kind: 'bar', amenities: [] }),
    ).toEqual([
      { kind: 'state', label: 'SP', slug: 'sp' },
      { kind: 'city', label: 'Santos', slug: 'sp-santos' },
      { kind: 'kind', label: 'bar', slug: 'bar' },
    ]);
  });

  it('drops an amenity it does not know', () => {
    const tags = placeTags({
      state: 'RJ',
      city: 'Niterói',
      neighbourhood: null,
      kind: 'club',
      amenities: ['wifi', 'open_late'],
    });
    expect(tags.filter((tag) => tag.kind === 'amenity').map((tag) => tag.slug)).toEqual([
      'open-late',
    ]);
  });
});
