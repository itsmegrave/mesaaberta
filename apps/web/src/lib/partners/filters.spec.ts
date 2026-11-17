import { describe, expect, it } from 'vitest';
import { readPartnerFilters } from '@mesaaberta/core/partners/filters';
import { partnerAdminFilters } from '@mesaaberta/core/partners/admin-filters';

describe('readPartnerFilters', () => {
  it('opens on the newest, first page', () => {
    expect(readPartnerFilters(new URLSearchParams(''))).toEqual({
      query: '',
      type: null,
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

  it('keeps a known kind and drops any other', () => {
    expect(readPartnerFilters(new URLSearchParams('type=publisher')).type).toBe('publisher');
    expect(readPartnerFilters(new URLSearchParams('type=none')).type).toBeNull();
    expect(readPartnerFilters(new URLSearchParams('type=hax')).type).toBeNull();
  });
});

describe('partnerAdminFilters', () => {
  it('opens on every partner', () => {
    expect(partnerAdminFilters(new URLSearchParams('')).status).toBe('all');
    expect(partnerAdminFilters(new URLSearchParams('status=nope')).status).toBe('all');
    expect(partnerAdminFilters(new URLSearchParams('status=pending')).status).toBe('pending');
  });
});
