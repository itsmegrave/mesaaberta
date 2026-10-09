import { pageNumber } from '$lib/admin/catalog';
import { PARTNER_SEARCH_MAX } from './filters';

/** Where a partner stands for the admin: waiting, up, with open reports, or taken down. */
export const PARTNER_ADMIN_STATUSES = ['pending', 'up', 'reported', 'removed', 'all'] as const;
export type PartnerAdminStatus = (typeof PARTNER_ADMIN_STATUSES)[number];

/** Whether the partner said where our link is. */
export const PARTNER_BACKLINK_FILTERS = ['any', 'given', 'missing'] as const;
export type PartnerBacklinkFilter = (typeof PARTNER_BACKLINK_FILTERS)[number];

export const PARTNER_ADMIN_PAGE_SIZE = 20;

export function partnerAdminFilters(params: URLSearchParams) {
  const status = params.get('status') ?? '';
  const backlink = params.get('backlink') ?? '';
  return {
    // The list opens on what waits for an admin.
    status: (PARTNER_ADMIN_STATUSES as readonly string[]).includes(status)
      ? (status as PartnerAdminStatus)
      : ('pending' as const),
    backlink: (PARTNER_BACKLINK_FILTERS as readonly string[]).includes(backlink)
      ? (backlink as PartnerBacklinkFilter)
      : ('any' as const),
    query: (params.get('q') ?? '').trim().slice(0, PARTNER_SEARCH_MAX),
    page: pageNumber(params.get('page')),
    pageSize: PARTNER_ADMIN_PAGE_SIZE,
  };
}
