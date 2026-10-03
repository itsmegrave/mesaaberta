import { TABLE_STATUSES, type TableStatus } from '$lib/tables/status-values';
import { pageSizeOf, sortOf } from './list';

export const TABLE_SORTS = ['created', 'title'] as const;
/** The Instagram post's state, as the filter names it: `none` is a table with no post to speak of. */
export const INSTAGRAM_FILTERS = [
  'all',
  'published',
  'queued',
  'uncertain',
  'failed',
  'none',
] as const;
export type InstagramFilter = (typeof INSTAGRAM_FILTERS)[number];

export function tableFilters(params: URLSearchParams) {
  const raw = params.get('status');
  const status: 'all' | TableStatus = TABLE_STATUSES.includes(raw as TableStatus)
    ? (raw as TableStatus)
    : 'all';
  const instagram = params.get('instagram');
  const page = params.get('page') ?? '1';
  return {
    status,
    instagram: (INSTAGRAM_FILTERS as readonly string[]).includes(instagram ?? '')
      ? (instagram as InstagramFilter)
      : ('all' as const),
    query: (params.get('q') ?? '').trim().slice(0, 100),
    page: /^\d+$/.test(page) ? Math.min(1000000, Math.max(1, Number(page))) : 1,
    pageSize: pageSizeOf(params),
    sort: sortOf(params, TABLE_SORTS, { id: 'created', dir: 'desc' }),
  };
}
