import { describe, expect, it } from 'vitest';
import { readPartnerFilters } from './filters';
import { partnerAdminFilters } from './admin-filters';

describe('readPartnerFilters', () => {
  it('opens on the newest, first page', () => {
    expect(readPartnerFilters(new URLSearchParams(''))).toEqual({
      query: '',
      sort: 'newest',
      page: 1,
    });
  });

  it('reads a page that is not a positive whole number as the first', () => {
    for (const bad of ['0', '-2', 'abc', '1.5']) {
      expect(readPartnerFilters(new URLSearchParams(`page=${bad}`)).page).toBe(1);
    }
    expect(readPartnerFilters(new URLSearchParams('page=3')).page).toBe(3);
  });

  it('falls back on a sort it does not know', () => {
    expect(readPartnerFilters(new URLSearchParams('sort=name')).sort).toBe('name');
    expect(readPartnerFilters(new URLSearchParams('sort=hax')).sort).toBe('newest');
  });
});

describe('partnerAdminFilters', () => {
  it('opens on what waits for review', () => {
    expect(partnerAdminFilters(new URLSearchParams('')).status).toBe('pending');
  });
});
