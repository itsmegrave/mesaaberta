import { describe, expect, it } from 'vitest';
import { adminSkeleton, arrivingSkeleton } from './skeletons';

const to = (pathname: string, id: string | null) => ({ url: { pathname }, route: { id } });
const kind = (from: string, next: ReturnType<typeof to> | null, signedIn = false) =>
  arrivingSkeleton({ pathname: from }, next, { signedIn })?.kind ?? null;

describe('arrivingSkeleton', () => {
  it('draws the list a page is on its way to, whatever route group holds it', () => {
    expect(kind('/', to('/tables', '/(tables)/tables'))).toBe('cards');
    expect(kind('/', to('/partners', '/(partners)/partners'))).toBe('cards');
    expect(kind('/', to('/messages', '/(messages)/messages'))).toBe('rows');
  });

  it('draws an item page in its own shape: a table, a system, a profile', () => {
    expect(kind('/tables', to('/t/a', '/(tables)/t/[slug]'))).toBe('detail');
    expect(kind('/systems', to('/s/gurps', '/s/[slug]'))).toBe('detail');
    expect(kind('/t/a', to('/u/ana', '/u/[username]'))).toBe('profile');
  });

  it('draws the next item when moving from one table to another', () => {
    expect(kind('/t/a', to('/t/b', '/(tables)/t/[slug]'))).toBe('detail');
  });

  it('draws the Início dashboard only for someone signed in, never the landing', () => {
    expect(kind('/tables', to('/', '/'), true)).toBe('home');
    expect(kind('/tables', to('/', '/'), false)).toBeNull();
  });

  it('draws Admin with the place of its nav when arriving from outside Admin', () => {
    expect(arrivingSkeleton({ pathname: '/' }, to('/admin/tables', '/admin/tables'))).toEqual({
      kind: 'admin',
      nav: true,
    });
  });

  it('leaves a move between Admin sections to the Admin layout, which keeps its nav', () => {
    expect(kind('/admin', to('/admin/users', '/admin/users'))).toBeNull();
  });

  it('leaves a filter or the pager to the page, which keeps its filters on screen', () => {
    expect(kind('/tables', to('/tables', '/(tables)/tables'))).toBeNull();
  });

  it('draws nothing for pages without a shape (forms) or while nothing is on its way', () => {
    expect(kind('/', to('/tables/new', '/(tables)/tables/new'))).toBeNull();
    expect(kind('/', to('/nowhere', null))).toBeNull();
    expect(kind('/', null)).toBeNull();
  });
});

describe('adminSkeleton', () => {
  it('draws the next Admin section beside the nav', () => {
    expect(adminSkeleton({ pathname: '/admin' }, { url: { pathname: '/admin/users' } })).toBe(true);
    expect(
      adminSkeleton({ pathname: '/admin/users' }, { url: { pathname: '/admin/users/1' } }),
    ).toBe(true);
  });

  it('leaves filters on the same section and pages outside Admin alone', () => {
    expect(adminSkeleton({ pathname: '/admin/users' }, { url: { pathname: '/admin/users' } })).toBe(
      false,
    );
    expect(adminSkeleton({ pathname: '/admin' }, { url: { pathname: '/tables' } })).toBe(false);
    expect(adminSkeleton({ pathname: '/admin' }, null)).toBe(false);
  });
});
