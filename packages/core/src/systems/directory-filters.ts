import { pageNumber } from '../admin/catalog';
import type { SearchParamsLike } from '../search-params';

/** Which systems the directory lists: those with a table open now (the default), or every one. */
export const SYSTEM_SHOWS = ['open', 'all'] as const;
export type SystemShow = (typeof SYSTEM_SHOWS)[number];

/** How it orders them: most open tables, most tables ever, or A to Z. */
export const SYSTEM_SORTS = ['open', 'played', 'az'] as const;
export type SystemSort = (typeof SYSTEM_SORTS)[number];

export const SYSTEM_DIRECTORY_PAGE_SIZE = 24;
export const SYSTEM_SEARCH_MAX = 100;

export type SystemDirectoryFilters = {
  query: string;
  show: SystemShow;
  sort: SystemSort;
  page: number;
};

const oneOf = <T extends string>(list: readonly T[], value: string | null, fallback: T): T =>
  (list as readonly string[]).includes(value ?? '') ? (value as T) : fallback;

/**
 * The filters in a `/systems` address. A link can say anything, so what is not a filter the page
 * knows is dropped rather than refused, and a page that is not a positive whole number reads as 1.
 */
export function readSystemDirectoryFilters(params: SearchParamsLike): SystemDirectoryFilters {
  return {
    query: (params.get('q') ?? '').trim().slice(0, SYSTEM_SEARCH_MAX),
    show: oneOf(SYSTEM_SHOWS, params.get('show'), 'open'),
    sort: oneOf(SYSTEM_SORTS, params.get('sort'), 'open'),
    page: pageNumber(params.get('page')),
  };
}

/** The query string of a filtered list, defaults left out so each list has one address. */
export function systemDirectoryQuery(filters: Omit<SystemDirectoryFilters, 'page'>, page = 1) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.show !== 'open') params.set('show', filters.show);
  if (filters.sort !== 'open') params.set('sort', filters.sort);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Lowercase without accents, so "cthulhu" finds "Call of Cthulhu" and "mascara" finds "Máscara". */
export const foldText = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
