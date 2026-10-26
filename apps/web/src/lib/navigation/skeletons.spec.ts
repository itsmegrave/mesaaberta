import { describe, expect, it } from 'vitest';
import { arrivingSkeleton } from './skeletons';

const to = (pathname: string, id: string | null) => ({ url: { pathname }, route: { id } });

describe('arrivingSkeleton', () => {
  it('draws the list a page is on its way to, whatever route group holds it', () => {
    expect(arrivingSkeleton({ pathname: '/' }, to('/tables', '/(tables)/tables'))).toBe('cards');
    expect(arrivingSkeleton({ pathname: '/' }, to('/partners', '/(partners)/partners'))).toBe(
      'cards',
    );
    expect(arrivingSkeleton({ pathname: '/' }, to('/messages', '/(messages)/messages'))).toBe(
      'rows',
    );
  });

  it('draws an item page in its own shape: a table, a system, a profile', () => {
    expect(arrivingSkeleton({ pathname: '/tables' }, to('/t/a', '/(tables)/t/[slug]'))).toBe(
      'detail',
    );
    expect(arrivingSkeleton({ pathname: '/systems' }, to('/s/gurps', '/s/[slug]'))).toBe('detail');
    expect(arrivingSkeleton({ pathname: '/t/a' }, to('/u/ana', '/u/[username]'))).toBe('profile');
  });

  it('draws the next item when moving from one table to another', () => {
    expect(arrivingSkeleton({ pathname: '/t/a' }, to('/t/b', '/(tables)/t/[slug]'))).toBe('detail');
  });

  it('leaves a filter or the pager to the page, which keeps its filters on screen', () => {
    expect(arrivingSkeleton({ pathname: '/tables' }, to('/tables', '/(tables)/tables'))).toBeNull();
  });

  it('draws nothing for pages without a shape (forms, admin) or while nothing is on its way', () => {
    expect(
      arrivingSkeleton({ pathname: '/' }, to('/tables/new', '/(tables)/tables/new')),
    ).toBeNull();
    expect(arrivingSkeleton({ pathname: '/' }, to('/admin', '/admin'))).toBeNull();
    expect(arrivingSkeleton({ pathname: '/' }, to('/nowhere', null))).toBeNull();
    expect(arrivingSkeleton({ pathname: '/' }, null)).toBeNull();
  });
});
