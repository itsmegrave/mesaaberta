import type { SkeletonKind } from '#lib/components/ui/ListSkeleton.svelte';

/**
 * The skeleton each page draws while it is on its way (design system: Loading). Keys are route ids
 * without their route groups, so moving a page into a group keeps its skeleton.
 */
const SKELETONS: Record<string, SkeletonKind> = {
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

/**
 * The skeleton that stands in for the page being left, when a page with one is on its way from
 * another page or another item. Within the same page (a filter, the pager: only the query changes)
 * there is none, because the page draws its own under the filters.
 */
export function arrivingSkeleton(
  from: { pathname: string },
  to: { url: { pathname: string }; route: { id: string | null } } | null,
): SkeletonKind | null {
  if (!to?.route.id || to.url.pathname === from.pathname) return null;
  return SKELETONS[to.route.id.replace(/\/\([^)]+\)/g, '') || '/'] ?? null;
}
