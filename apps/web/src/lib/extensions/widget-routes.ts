/**
 * The route id a widget is placed by: SvelteKit's id without its layout groups, so `/(tables)/t/[slug]`
 * reads `/t/[slug]` and an extension's placements do not change when the folders are grouped.
 */
export function placementRoute(routeId: string | null): string | null {
  return routeId && routeId.replace(/\/\([^)/]+\)/g, '');
}

/**
 * Whether a widget may float over the page with this SvelteKit route id. Never over the admin,
 * signing in and out, onboarding, the legal pages, or a form someone is filling in (it would sit
 * over an unsaved draft), nor over a widget's own page.
 */
export function showsWidgets(routeId: string | null): boolean {
  if (!routeId) return false;
  if (CLOSED.some((prefix) => routeId === prefix || routeId.startsWith(`${prefix}/`))) return false;
  return !/\/(new|edit|manage|setup)(\/|$)/.test(routeId);
}

const CLOSED = [
  '/admin',
  '/auth',
  '/login',
  '/signup',
  '/logout',
  '/forgot',
  '/reset',
  '/maintenance',
  '/privacy',
  '/terms',
  '/[ext]',
];
