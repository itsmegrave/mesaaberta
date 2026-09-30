import { resolve } from '$app/paths';
import { localizeHref, type Locale } from '$lib/paraglide/runtime';

/**
 * Internal link to `pathname` in `locale`. `pathname` may already carry a locale prefix.
 * Localized paths (`/en/...`) are not route ids; `reroute` maps them back. Cast the argument
 * tuple so the generated route overloads accept a dynamic localized pathname.
 */
export const localizedHref = (pathname: string, locale: Locale) =>
  // `resolve` takes its argument as a union of one tuple per route, which TypeScript stops matching
  // a `Pathname` against once the app has more than 25 routes; spreading the tuple keeps the call.
  resolve(...([localizeHref(pathname, { locale })] as [Pathname] as Parameters<typeof resolve>));
