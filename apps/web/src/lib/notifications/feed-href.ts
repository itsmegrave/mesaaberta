import type { NotificationCategory } from '@mesaaberta/core/notifications/kinds';

export type FeedQuery = { category: NotificationCategory | null; unread: boolean; page: number };

/**
 * The address of the feed for a filter and a page: `/n`, then `category`, `unread=1` and `page`
 * only when they differ from the default, so each view has one address (the first page has no
 * `page`).
 */
export function feedHref({ category, unread, page }: FeedQuery): string {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (unread) params.set('unread', '1');
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/n?${query}` : '/n';
}
