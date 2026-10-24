import { describe, expect, it } from 'vitest';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';

describe('safeNext', () => {
  it.each(['/', '/t', '/t/mesa-do-dragao', '/t?page=2', '/t#top'])(
    'keeps the on-site path %s',
    (path) => {
      expect(safeNext(path)).toBe(path);
    },
  );

  it.each([
    ['another site', 'https://evil.example/'],
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash trick', '/\\evil.example'],
    ['a tab-smuggled protocol-relative URL', '/\t/evil.example'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a relative path without a leading slash', 'tables'],
    ['an empty string', ''],
    ['nothing', null],
  ])('falls back to the home page for %s', (_name, value) => {
    expect(safeNext(value)).toBe('/');
  });

  it('canonicalizes old bookmarked destinations without losing filters or fragments', () => {
    expect(safeNext('/en/account/tables?page=2#running')).toBe('/u/tables?page=2#running');
    expect(safeNext('/tables/dragon/manage?/publish')).toBe('/t/dragon/manage?/publish');
  });

  it('uses the fallback it is given', () => {
    expect(safeNext('https://evil.example', '/account')).toBe('/account');
    expect(safeNext('//evil.example', '/tables?page=2')).toBe('/t?page=2');
  });
});
