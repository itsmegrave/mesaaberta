import { resolve } from '$app/paths';
import type { Pathname } from '$app/types';
import { localizeHref, type Locale } from '$lib/paraglide/runtime';

/**
 * Internal link to `pathname` in `locale`. `pathname` may already carry a locale prefix.
 * The cast is needed because localized paths (`/en/...`) are not route ids; `reroute` maps them back.
 */
export const localizedHref = (pathname: string, locale: Locale) =>
	resolve(localizeHref(pathname, { locale }) as Pathname);
