import { PROFILE_STANDINGS, type ProfileStanding } from '$lib/profile/standing';
import { pageSizeOf, sortOf } from './list';

export const PROFILE_SORTS = ['user', 'joined'] as const;

export function profileFilters(params: URLSearchParams) {
  const status = params.get('status');
  const selectedStatus: 'all' | ProfileStanding = PROFILE_STANDINGS.includes(
    status as ProfileStanding,
  )
    ? (status as ProfileStanding)
    : 'all';
  const page = params.get('page') ?? '1';
  return {
    status: selectedStatus,
    query: (params.get('q') ?? '').trim().slice(0, 100),
    page: /^\d+$/.test(page) ? Math.min(1_000_000, Math.max(1, Number(page))) : 1,
    pageSize: pageSizeOf(params),
    sort: sortOf(params, PROFILE_SORTS, { id: 'joined', dir: 'desc' }),
  };
}
