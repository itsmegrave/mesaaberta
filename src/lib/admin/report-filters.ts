import { pageNumber } from './catalog';

/** The queue's status filter. `waiting` (the default) is open and in review together. */
export const REPORT_FILTERS = ['waiting', 'resolved', 'dismissed', 'all'] as const;
export type ReportFilter = (typeof REPORT_FILTERS)[number];

export const REPORT_PAGE_SIZE = 20;
export const AUDIT_PAGE_SIZE = 30;

export function reportFilters(params: URLSearchParams) {
  const status = params.get('status');
  return {
    status: (REPORT_FILTERS as readonly string[]).includes(status ?? '')
      ? (status as ReportFilter)
      : ('waiting' as const),
    page: pageNumber(params.get('page')),
  };
}
