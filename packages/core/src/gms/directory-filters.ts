import { pageNumber } from '../admin/catalog';
import type { SearchParamsLike } from '../search-params';
import { SYSTEM_SEARCH_MAX } from '../systems/directory-filters';

/**
 * How Quem mestra orders people: who ran a table most recently (the default, so people new to it
 * are not buried under high scores), the best score (people without one after everyone with one),
 * the most tables run, or by name.
 */
export const GM_SORTS = ['recent', 'score', 'tables', 'name'] as const;
export type GmSort = (typeof GM_SORTS)[number];

/** Where the tables a person ran happened. */
export const GM_MODALITIES = ['online', 'in_person'] as const;
export type GmModality = (typeof GM_MODALITIES)[number];

export const GM_DIRECTORY_PAGE_SIZE = 12;

export type GmDirectoryFilters = {
  /** Name or @username, without minding accents or case. */
  query: string;
  /** A system's slug: people who ran a table of it. */
  system: string;
  /** People who ran a table of this modality. */
  modality: GmModality | '';
  /** Only people with a table open now. */
  open: boolean;
  sort: GmSort;
  page: number;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const oneOf = <T extends string>(list: readonly T[], value: string | null, fallback: T): T =>
  (list as readonly string[]).includes(value ?? '') ? (value as T) : fallback;

/**
 * The filters in a `/gamemasters` address. A link can say anything, so what is not a filter the
 * page knows is dropped rather than refused, and a page that is not a positive whole number reads
 * as 1.
 */
export function readGmDirectoryFilters(params: SearchParamsLike): GmDirectoryFilters {
  const system = (params.get('system') ?? '').trim().toLowerCase();
  return {
    query: (params.get('q') ?? '').trim().replace(/^@/, '').slice(0, SYSTEM_SEARCH_MAX),
    system: SLUG.test(system) ? system : '',
    modality: oneOf<GmModality | ''>(GM_MODALITIES, params.get('modality'), ''),
    open: params.get('open') === '1',
    sort: oneOf(GM_SORTS, params.get('sort'), 'recent'),
    page: pageNumber(params.get('page')),
  };
}

/** The query string of a filtered list, defaults left out so each list has one address. */
export function gmDirectoryQuery(filters: Omit<GmDirectoryFilters, 'page'>, page = 1) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.system) params.set('system', filters.system);
  if (filters.modality) params.set('modality', filters.modality);
  if (filters.open) params.set('open', '1');
  if (filters.sort !== 'recent') params.set('sort', filters.sort);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `?${query}` : '';
}
