import { pageNumber } from './catalog';
import { pageSizeOf, sortOf } from './list';

/** The queue's status filter. `waiting` (the default) is open and in review together. */
export const REPORT_FILTERS = ['waiting', 'resolved', 'dismissed', 'all'] as const;
export type ReportFilter = (typeof REPORT_FILTERS)[number];

/** What a report is about: a table, a player, a crowdfunding campaign, or any. */
export const REPORT_TARGETS = ['all', 'table', 'player', 'crowdfunding'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_SORTS = ['filed'] as const;

export const REPORT_PAGE_SIZE = 20;
export const AUDIT_PAGE_SIZE = 20;

export function reportFilters(params: URLSearchParams) {
  const status = params.get('status');
  const target = params.get('target');
  return {
    status: (REPORT_FILTERS as readonly string[]).includes(status ?? '')
      ? (status as ReportFilter)
      : ('waiting' as const),
    target: (REPORT_TARGETS as readonly string[]).includes(target ?? '')
      ? (target as ReportTarget)
      : ('all' as const),
    page: pageNumber(params.get('page')),
    pageSize: pageSizeOf(params, REPORT_PAGE_SIZE),
    sort: sortOf(params, REPORT_SORTS, { id: 'filed', dir: 'desc' }),
  };
}

/** The audit log's kind of decision, for its segmented filter. */
export const AUDIT_KINDS = [
  'all',
  'reports',
  'accounts',
  'tables',
  'catalog',
  'announcements',
] as const;
export type AuditKind = (typeof AUDIT_KINDS)[number];

export function auditFilters(params: URLSearchParams) {
  const kind = params.get('kind');
  return {
    kind: (AUDIT_KINDS as readonly string[]).includes(kind ?? '')
      ? (kind as AuditKind)
      : ('all' as const),
    query: (params.get('q') ?? '').trim().slice(0, 100),
    page: pageNumber(params.get('page')),
    pageSize: pageSizeOf(params, AUDIT_PAGE_SIZE),
  };
}
