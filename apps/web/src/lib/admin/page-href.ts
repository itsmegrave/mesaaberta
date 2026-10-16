import { localizedHref } from '#lib/i18n/locales.js';
import type { Locale } from '#lib/paraglide/runtime.js';
import type { SearchParamsLike } from '@mesaaberta/core/search-params';

/**
 * The link to page `page` of the paginated list at `path`, keeping the other filters in `current`.
 * The first page has no `page` parameter, so it has one address.
 */
export function pageHref(path: string, current: SearchParamsLike, page: number, locale: Locale) {
  const params = new URLSearchParams(current.toString());
  if (page > 1) params.set('page', String(page));
  else params.delete('page');
  const query = params.toString();
  return localizedHref(query ? `${path}?${query}` : path, locale);
}
