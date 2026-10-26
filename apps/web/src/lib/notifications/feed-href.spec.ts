import { describe, expect, it } from 'vitest';
import { feedHref } from './feed-href';

describe('feedHref', () => {
  it('gives the plain feed one address', () => {
    expect(feedHref({ category: null, unread: false, page: 1 })).toBe('/notifications');
  });

  it('keeps the category and the unread filter together, and the page past the first', () => {
    expect(feedHref({ category: 'table', unread: true, page: 3 })).toBe(
      '/notifications?category=table&unread=1&page=3',
    );
    expect(feedHref({ category: 'table', unread: false, page: 1 })).toBe(
      '/notifications?category=table',
    );
  });
});
