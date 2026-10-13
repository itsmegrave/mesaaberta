import { describe, expect, it } from 'vitest';
import { readTableFilters } from './filters';

const read = (search: string) => readTableFilters(new URL(`https://x.test/tables${search}`));

describe('readTableFilters', () => {
  it('reads nothing ticked as no filter', async () => {
    expect(await read('')).toEqual({ systems: [], modality: null, platforms: [], tags: [] });
  });

  it('takes each key as often as it repeats, as slugs', async () => {
    expect(
      await read(
        '?system=daggerheart&system=dnd-5e&modality=online&platform=discord&tag=terror&tag=humor',
      ),
    ).toEqual({
      systems: ['daggerheart', 'dnd-5e'],
      modality: 'online',
      platforms: ['discord'],
      tags: ['terror', 'humor'],
    });
  });

  it('drops what it does not know, instead of failing the page', async () => {
    expect(await read('?modality=nope&system=&system=Not%20A%20Slug&tag=terror')).toEqual({
      systems: [],
      modality: null,
      platforms: [],
      tags: ['terror'],
    });
  });

  it('ignores keys that are not filters', async () => {
    expect(await read('?utm_source=x&tag=terror')).toMatchObject({ tags: ['terror'] });
  });
});
