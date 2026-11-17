import { pageNumber } from '../admin/catalog';
import { SYSTEM_SEARCH_MAX } from '../systems/directory-filters';

/** Where a place stands for the admin: waiting, up, with open reports, or taken down. */
export const PLACE_ADMIN_STATUSES = ['pending', 'up', 'reported', 'removed', 'all'] as const;
export type PlaceAdminStatus = (typeof PLACE_ADMIN_STATUSES)[number];

export const PLACE_ADMIN_PAGE_SIZE = 20;

/** The filters of `/admin/places`. It opens on what waits for an admin, oldest first. */
export function placeAdminFilters(params: URLSearchParams) {
  const status = params.get('status') ?? '';
  return {
    status: (PLACE_ADMIN_STATUSES as readonly string[]).includes(status)
      ? (status as PlaceAdminStatus)
      : ('pending' as const),
    // The name, the city or the @usuário of whoever sent it.
    query: (params.get('q') ?? '').trim().slice(0, SYSTEM_SEARCH_MAX),
    page: pageNumber(params.get('page')),
    pageSize: PLACE_ADMIN_PAGE_SIZE,
  };
}
