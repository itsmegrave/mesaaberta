import { describe, expect, it } from 'vitest';
import { RESERVED_USERNAMES } from './profile/username';
import { canonicalPath, legacyRedirect, routes } from './routes';

describe('language-independent routes', () => {
  it.each([
    ['/en', '/'],
    ['/pt-BR', '/'],
    ['/tables/dragao/manage', '/t/dragao/manage'],
    ['/partners/42/edit', '/p/42/edit'],
    ['/crowdfunding/new', '/cf/new'],
    ['/messages/42', '/m/42'],
    ['/notifications', '/n'],
    ['/account/tables/calendar', '/u/tables/calendar'],
    ['/account/profile', '/u/profile/edit'],
    ['/account/invitations/abc', '/u/profile/invitations/abc'],
    ['/account/connect/google', '/u/profile/connect/google'],
    ['/account/export', '/u/profile/export'],
    ['/onboarding/username', '/u/profile/setup/username'],
    ['/forgot-password', '/forgot'],
    ['/reset-password', '/reset'],
    ['/en/tables/dragao', '/t/dragao'],
    ['/pt-BR/partners', '/p'],
    ['/en/t/dragao', '/t/dragao'],
  ])('keeps the full resource path for %s', (oldPath, target) => {
    expect(canonicalPath(oldPath)).toBe(target);
  });

  it.each([
    '/u/ana',
    '/u/tables',
    '/u/profile/edit',
    '/api/messages/42',
    '/v1/tables/42',
    '/admin/tables',
    '/healthz',
    '/tablespoon',
    '/login',
    '/auth/callback',
  ])('does not rewrite an unrelated or canonical route %s', (path) => {
    expect(canonicalPath(path)).toBe(path);
  });

  it('permanently redirects old GET and HEAD URLs with the original search and fragment', () => {
    const url = new URL(
      'https://mesaaberta.app/en/tables/dragao/manage?status=open&page=2&tag=a%2Fb#players',
    );
    for (const method of ['GET', 'HEAD']) {
      expect(legacyRedirect(url, method)).toEqual({
        status: 308,
        location: '/t/dragao/manage?status=open&page=2&tag=a%2Fb#players',
      });
    }
  });

  it('lets legacy mutations reach the rerouted action without changing their method or body', () => {
    const url = new URL('https://mesaaberta.app/account/profile?/save&next=%2Ftables');
    expect(legacyRedirect(url, 'POST')).toBeNull();
    expect(canonicalPath(url.pathname)).toBe('/u/profile/edit');
  });

  it('never turns a malformed locale prefix into an external redirect', () => {
    expect(legacyRedirect(new URL('https://mesaaberta.app/en//evil.example'), 'GET')).toBeNull();
  });

  it('does not redirect a canonical path', () => {
    expect(legacyRedirect(new URL('https://mesaaberta.app/t?page=2'), 'GET')).toBeNull();
  });

  it.each(['tables', 'profile'])(
    'reserves the private /u namespace %s from public usernames',
    (namespace) => {
      expect(RESERVED_USERNAMES.has(namespace)).toBe(true);
    },
  );

  it.each(['connect', 'export'])('keeps the existing public username %s available', (username) => {
    expect(RESERVED_USERNAMES.has(username)).toBe(false);
    expect(canonicalPath(`/u/${username}`)).toBe(`/u/${username}`);
  });

  it('encodes identifiers once in shared outbound URL builders', () => {
    expect(routes.table('dragao azul')).toBe('/t/dragao%20azul');
    expect(routes.conversation('a/b')).toBe('/m/a%2Fb');
    expect(routes.profile('ana')).toBe('/u/ana');
  });
});
