import { pageNumber } from '../admin/catalog';
import type { SearchParamsLike } from '../search-params';
import { SYSTEM_SEARCH_MAX } from '../systems/directory-filters';
import { isPlaceKind, type PlaceKind } from './types';

/** How "Onde jogar" orders places: most tables open there now, the newest, or by name. */
export const PLACE_SORTS = ['open', 'recent', 'name'] as const;
export type PlaceSort = (typeof PLACE_SORTS)[number];

export const PLACE_PAGE_SIZE = 12;

export type PlaceFilters = {
  /** The name, the description or the area, without minding accents or case. */
  query: string;
  /** A state tag (`pe`). */
  state: string;
  /** A city tag (`pe-recife`), only within the state picked. */
  city: string;
  kind: PlaceKind | '';
  /** Tags (`place_features` slugs) a place must have every one of, A to Z. */
  tags: string[];
  /** Only places shown as a partner's ("Só parceiros", `?partner=1`). */
  partner: boolean;
  sort: PlaceSort;
  page: number;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATE = /^[a-z]{2}$/;
/** How many tags one list may ask for at once. */
export const MAX_TAG_FILTERS = 10;
const oneOf = <T extends string>(list: readonly T[], value: string | null, fallback: T): T =>
  (list as readonly string[]).includes(value ?? '') ? (value as T) : fallback;

/**
 * The filters in a `/places` address. A link can say anything, so what is not a filter the page
 * knows is dropped rather than refused, and a page that is not a positive whole number reads as 1.
 * A city outside the state picked is dropped too, so the two never contradict each other.
 */
export function readPlaceFilters(params: SearchParamsLike): PlaceFilters {
  const state = (params.get('state') ?? '').trim().toLowerCase();
  const city = (params.get('city') ?? '').trim().toLowerCase();
  // Kinds are written with dashes in the address, as their tags are. `amenity` is the address the
  // Comodidades had before the catalog: their slugs are the same, with dashes.
  const kind = (params.get('kind') ?? '').replaceAll('-', '_');
  const picked = [...params.getAll('tag'), ...params.getAll('amenity')]
    .map((slug) => slug.trim().toLowerCase().replaceAll('_', '-'))
    .filter((slug) => SLUG.test(slug));
  const okState = STATE.test(state) ? state : '';
  return {
    query: (params.get('q') ?? '').trim().slice(0, SYSTEM_SEARCH_MAX),
    state: okState,
    city: okState && SLUG.test(city) && city.startsWith(`${okState}-`) ? city : '',
    kind: isPlaceKind(kind) ? kind : '',
    tags: [...new Set(picked)].sort().slice(0, MAX_TAG_FILTERS),
    partner: params.get('partner') === '1',
    sort: oneOf(PLACE_SORTS, params.get('sort'), 'open'),
    page: pageNumber(params.get('page')),
  };
}

/** The query string of a filtered list, defaults left out so each list has one address. */
export function placeDirectoryQuery(filters: Omit<PlaceFilters, 'page'>, page = 1) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.state) params.set('state', filters.state);
  if (filters.state && filters.city) params.set('city', filters.city);
  if (filters.kind) params.set('kind', filters.kind.replaceAll('_', '-'));
  for (const tag of [...filters.tags].sort()) params.append('tag', tag);
  if (filters.partner) params.set('partner', '1');
  if (filters.sort !== 'open') params.set('sort', filters.sort);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * The `/places` address that lists what a tag stands for: a tag on a place's page links there. A
 * neighbourhood lists its city (the filters go no finer), found among the place's own `tags`.
 */
export function tagHref(
  tag: { kind: string; slug: string },
  tags: readonly { kind: string; slug: string }[],
): string {
  const state = tags.find((other) => other.kind === 'state')?.slug ?? '';
  const city = tags.find((other) => other.kind === 'city')?.slug ?? '';
  if (tag.kind === 'state') return `/places${placeDirectoryQuery({ ...NO_FILTERS, state })}`;
  if (tag.kind === 'city' || tag.kind === 'neighbourhood') {
    return `/places${placeDirectoryQuery({ ...NO_FILTERS, state, city })}`;
  }
  if (tag.kind === 'kind') {
    const kind = tag.slug.replaceAll('-', '_');
    return `/places${placeDirectoryQuery({ ...NO_FILTERS, kind: isPlaceKind(kind) ? kind : '' })}`;
  }
  return `/places${placeDirectoryQuery({ ...NO_FILTERS, tags: [tag.slug] })}`;
}

/** The list with nothing picked. */
export const NO_FILTERS: Omit<PlaceFilters, 'page'> = {
  query: '',
  state: '',
  city: '',
  kind: '',
  tags: [],
  partner: false,
  sort: 'open',
};
