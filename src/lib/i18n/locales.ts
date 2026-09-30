import { resolve } from '$app/paths';
import type { Pathname } from '$app/types';
import { localizeHref, type Locale } from '$lib/paraglide/runtime';

/**
 * Internal link to `pathname` in `locale`. `pathname` may already carry a locale prefix.
 * The cast is needed because localized paths (`/en/...`) are not route ids; `reroute` maps them back.
 */
export const localizedHref = (pathname: string, locale: Locale) =>
  // `resolve` takes its argument as a union of one tuple per route, which TypeScript stops matching
  // a `Pathname` against once the app has more than 25 routes; spreading the tuple keeps the call.
  resolve(...([localizeHref(pathname, { locale })] as [Pathname] as Parameters<typeof resolve>));
