import { describe, expect, it } from 'vitest';
import { placeTags } from './tags';

describe('placeTags', () => {
  it('tags the address, the kind and each picked catalog entry in the order picked', () => {
    expect(
      placeTags({
        state: 'PE',
        city: 'Recife',
        neighbourhood: 'Boa Viagem',
        kind: 'game_cafe',
        features: [
          { name: 'Sem taxa para jogar', slug: 'free-to-play' },
          { name: 'RPG de mesa', slug: 'rpg' },
        ],
      }),
    ).toEqual([
      { kind: 'state', label: 'PE', slug: 'pe' },
      { kind: 'city', label: 'Recife', slug: 'pe-recife' },
      { kind: 'neighbourhood', label: 'Boa Viagem', slug: 'pe-recife-boa-viagem' },
      { kind: 'kind', label: 'game_cafe', slug: 'game-cafe' },
      { kind: 'feature', label: 'Sem taxa para jogar', slug: 'free-to-play' },
      { kind: 'feature', label: 'RPG de mesa', slug: 'rpg' },
    ]);
  });

  it('leaves the neighbourhood out when the CEP has none, and keeps two cities apart', () => {
    const centro = (city: string) =>
      placeTags({ state: 'SP', city, neighbourhood: 'Centro', kind: 'store', features: [] });
    expect(centro('São Paulo').find((tag) => tag.kind === 'neighbourhood')?.slug).toBe(
      'sp-sao-paulo-centro',
    );
    expect(centro('Santos').find((tag) => tag.kind === 'neighbourhood')?.slug).toBe(
      'sp-santos-centro',
    );
    expect(
      placeTags({ state: 'SP', city: 'Santos', neighbourhood: null, kind: 'bar', features: [] }),
    ).toEqual([
      { kind: 'state', label: 'SP', slug: 'sp' },
      { kind: 'city', label: 'Santos', slug: 'sp-santos' },
      { kind: 'kind', label: 'bar', slug: 'bar' },
    ]);
  });
});
