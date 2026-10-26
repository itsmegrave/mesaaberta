import type { SkeletonKind } from '#lib/components/ui/ListSkeleton.svelte';

/**
 * The skeleton each page draws while it is on its way (design system: Loading). Keys are route ids
 * without their route groups, so moving a page into a group keeps its skeleton.
 */
const SKELETONS: Record<string, SkeletonKind> = {
  '/': 'home',
  '/tables': 'cards',
  '/systems': 'cards',
  '/partners': 'cards',
  '/crowdfunding': 'cards',
  '/gamemasters': 'cards',
  '/places': 'cards',
  '/u/tables': 'columns',
  '/notifications': 'rows',
  '/messages': 'rows',
  '/blog': 'rows',
  '/t/[slug]': 'detail',
  '/s/[slug]': 'detail',
  '/pp/[slug]': 'detail',
  '/blog/[slug]': 'detail',
  '/u/[username]': 'profile',
};

/** What the layout draws for a page on its way: a skeleton, and for Admin whether it holds the nav. */
export type Arriving = { kind: SkeletonKind; nav?: boolean };

const isAdmin = (path: string) => path === '/admin' || path.startsWith('/admin/');

/**
 * The skeleton that stands in for the page being left, when a page with one is on its way from
 * another page or another item. Within the same page (a filter, the pager: only the query changes)
 * there is none, because the page draws its own under the filters. Início has one only for the
 * signed-in (the dashboard; the landing has none). Between two Admin sections the Admin layout
 * draws it beside its nav (`adminSkeleton`); arriving from outside, this one holds the nav's place.
 */
export function arrivingSkeleton(
  from: { pathname: string },
  to: { url: { pathname: string }; route: { id: string | null } } | null,
  { signedIn = false }: { signedIn?: boolean } = {},
): Arriving | null {
  if (!to?.route.id || to.url.pathname === from.pathname) return null;
  if (isAdmin(to.url.pathname)) return isAdmin(from.pathname) ? null : { kind: 'admin', nav: true };
  const kind = SKELETONS[to.route.id.replace(/\/\([^)]+\)/g, '') || '/'] ?? null;
  if (kind === 'home' && !signedIn) return null;
  return kind && { kind };
}

/** Between two Admin sections: the section's skeleton, drawn by the Admin layout beside its nav. */
export function adminSkeleton(
  from: { pathname: string },
  to: { url: { pathname: string } } | null,
): boolean {
  return (
    !!to && to.url.pathname !== from.pathname && isAdmin(to.url.pathname) && isAdmin(from.pathname)
  );
}
