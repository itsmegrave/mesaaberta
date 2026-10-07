import { describe, expect, it } from 'vitest';
import { readCrowdfundingFilters } from './filters';

const read = (query: string) => readCrowdfundingFilters(new URLSearchParams(query));

describe('readCrowdfundingFilters', () => {
  it('defaults to the running list, soonest end first, on the first page', () => {
    expect(read('')).toEqual({ query: '', platforms: [], sort: 'ending', ended: false, page: 1 });
  });

  it('keeps the platforms it knows, once each, and drops the rest', () => {
    expect(
      read('platform=catarse&platform=catarse&platform=evil&platform=gamefound').platforms,
    ).toEqual(['catarse', 'gamefound']);
  });

  it('reads a page that is not a positive whole number as the first', () => {
    expect(read('page=0').page).toBe(1);
    expect(read('page=abc').page).toBe(1);
    expect(read('page=3').page).toBe(3);
  });

  it('knows the ended list and falls back to the default order', () => {
    expect(read('status=ended&sort=hax')).toMatchObject({ ended: true, sort: 'ending' });
    expect(read('sort=name').sort).toBe('name');
  });

  it('trims and caps the search text', () => {
    expect(read(`q=${encodeURIComponent('  rpg  ')}`).query).toBe('rpg');
    expect(read(`q=${'a'.repeat(300)}`).query).toHaveLength(100);
  });
});
