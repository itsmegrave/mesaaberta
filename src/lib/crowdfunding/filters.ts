import { pageNumber } from '$lib/admin/catalog';
import { CROWDFUNDING_PLATFORMS, type CrowdfundingPlatform } from './platforms';

/** How the public list is ordered: what ends (or opens) first, what was added last, or by name. */
export const CROWDFUNDING_SORTS = ['ending', 'newest', 'name'] as const;
export type CrowdfundingSort = (typeof CROWDFUNDING_SORTS)[number];

export const CROWDFUNDING_PAGE_SIZE = 12;
export const SEARCH_MAX = 100;

export type CrowdfundingFilters = {
  query: string;
  platforms: CrowdfundingPlatform[];
  sort: CrowdfundingSort;
  /** The list of campaigns that already ended, instead of the running and upcoming ones. */
  ended: boolean;
  page: number;
};

/**
 * The filters in a `/financiamentos` address. A link can say anything, so what is not a filter the
 * page knows is dropped rather than refused: the list still shows, just without it.
 */
export function readCrowdfundingFilters(params: URLSearchParams): CrowdfundingFilters {
  const sort = params.get('sort') ?? '';
  return {
    query: (params.get('q') ?? '').trim().slice(0, SEARCH_MAX),
    platforms: [
      ...new Set(
        params
          .getAll('platform')
          .filter((value): value is CrowdfundingPlatform =>
            (CROWDFUNDING_PLATFORMS as readonly string[]).includes(value),
          ),
      ),
    ],
    sort: (CROWDFUNDING_SORTS as readonly string[]).includes(sort)
      ? (sort as CrowdfundingSort)
      : 'ending',
    ended: params.get('status') === 'ended',
    page: pageNumber(params.get('page')),
  };
}
