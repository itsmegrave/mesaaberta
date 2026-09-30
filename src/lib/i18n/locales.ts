import { resolve } from '$app/paths';
import { localizeHref, type Locale } from '$lib/paraglide/runtime';

/**
 * Internal link to `pathname` in `locale`. `pathname` may already carry a locale prefix.
 * Localized paths (`/en/...`) are not route ids; `reroute` maps them back. Cast the argument
 * tuple so the generated route overloads accept a dynamic localized pathname.
 */
export const localizedHref = (pathname: string, locale: Locale) =>
  resolve(...([localizeHref(pathname, { locale })] as Parameters<typeof resolve>));
