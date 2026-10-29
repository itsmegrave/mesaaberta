import { z } from 'zod';
import { pageNumber } from '../admin/catalog';
import type { SearchParamsLike } from '../search-params';
import { SYSTEM_SEARCH_MAX } from '../systems/directory-filters';

// "Procuro mesa" (`/players`): people who say they are looking for a table, for GMs to invite.

/** The line a person writes for GMs. Mirrors the check on `profiles.looking_for_table_note`. */
export const LOOKING_NOTE_MAX = 200;
/** How long someone stays listed after saying they are looking, unless they say it again. */
export const LOOKING_DAYS = 60;
export const PLAYERS_PAGE_SIZE = 12;

/** "Estou procurando mesa": on with a note, or off. */
export const lookingSchema = z.object({
  looking: z.boolean(),
  note: z
    .string()
    .transform((value) => value.replace(/\s+/g, ' ').trim())
    .pipe(z.string().max(LOOKING_NOTE_MAX, 'too_long'))
    .default(''),
});
export type LookingInput = z.output<typeof lookingSchema>;

export type PlayerFilters = {
  /** Name, @username or the note, without minding accents or case. */
  query: string;
  /** A system's slug: people with it among their favorite systems. */
  system: string;
  page: number;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The filters in a `/players` address; what is not a filter is dropped, a bad page reads as 1. */
export function readPlayerFilters(params: SearchParamsLike): PlayerFilters {
  const system = (params.get('system') ?? '').trim().toLowerCase();
  return {
    query: (params.get('q') ?? '').trim().replace(/^@/, '').slice(0, SYSTEM_SEARCH_MAX),
    system: SLUG.test(system) ? system : '',
    page: pageNumber(params.get('page')),
  };
}

/** The query string of a filtered list, defaults left out so each list has one address. */
export function playerQuery(filters: Omit<PlayerFilters, 'page'>, page = 1) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.system) params.set('system', filters.system);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `?${query}` : '';
}
