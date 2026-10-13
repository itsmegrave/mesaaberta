import { pageNumber } from '$lib/admin/catalog';
import { SEARCH_MAX } from './filters';

/** The admin list's filter: what is up, what an admin took down, or both. */
export const CROWDFUNDING_ADMIN_STATUSES = ['up', 'removed', 'all'] as const;
export type CrowdfundingAdminStatus = (typeof CROWDFUNDING_ADMIN_STATUSES)[number];

export const CROWDFUNDING_ADMIN_PAGE_SIZE = 20;

export function crowdfundingAdminFilters(params: URLSearchParams) {
  const status = params.get('status') ?? '';
  return {
    status: (CROWDFUNDING_ADMIN_STATUSES as readonly string[]).includes(status)
      ? (status as CrowdfundingAdminStatus)
      : ('up' as const),
    query: (params.get('q') ?? '').trim().slice(0, SEARCH_MAX),
    page: pageNumber(params.get('page')),
    pageSize: CROWDFUNDING_ADMIN_PAGE_SIZE,
  };
}
