import { pageNumber } from '$lib/admin/catalog';

/** How the public list is ordered: what was added last, or by name. */
export const PARTNER_SORTS = ['newest', 'name'] as const;
export type PartnerSort = (typeof PARTNER_SORTS)[number];

export const PARTNER_PAGE_SIZE = 12;
export const PARTNER_SEARCH_MAX = 100;

export type PartnerFilters = { query: string; sort: PartnerSort; page: number };

/**
 * The filters in a `/parceiros` address. A link can say anything, so what is not a filter the page
 * knows is dropped rather than refused: the list still shows, just without it.
 */
export function readPartnerFilters(params: URLSearchParams): PartnerFilters {
  const sort = params.get('sort') ?? '';
  return {
    query: (params.get('q') ?? '').trim().slice(0, PARTNER_SEARCH_MAX),
    sort: (PARTNER_SORTS as readonly string[]).includes(sort) ? (sort as PartnerSort) : 'newest',
    page: pageNumber(params.get('page')),
  };
}
