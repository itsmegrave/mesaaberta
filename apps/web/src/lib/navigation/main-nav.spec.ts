import { describe, expect, it } from 'vitest';
import { MAIN_NAV, isUnder, mainNav } from './main-nav';

const link = (href: string) => MAIN_NAV.find((item) => item.href === href)!;

describe('isUnder', () => {
  it('matches the page and the pages under it, not a longer name', () => {
    expect(isUnder('/t', '/t')).toBe(true);
    expect(isUnder('/t/abc', '/t')).toBe(true);
    expect(isUnder('/tables', '/t')).toBe(false);
    expect(isUnder('/u/tablespoon', '/u/tables')).toBe(false);
  });

  it('leaves out the excepted pages', () => {
    expect(isUnder('/t/new', '/t', ['/t/new'])).toBe(false);
    expect(isUnder('/t/new/x', '/t', ['/t/new'])).toBe(true);
  });
});

describe('MAIN_NAV current-page rules', () => {
  it('keeps Abrir mesa apart from Mesas', () => {
    expect(link('/t').current('/t/new')).toBe(false);
    expect(link('/t/new').current('/t/new')).toBe(true);
    expect(link('/t').current('/t/some-table/manage')).toBe(true);
  });

  it('does not count the profile as Minhas mesas', () => {
    expect(link('/u/tables').current('/u/profile/edit')).toBe(false);
    expect(link('/u/tables').current('/u/tables')).toBe(true);
  });
});

describe('mainNav', () => {
  const hrefs = (links: { href: string }[]) => links.map((item) => item.href);

  it('hides the members’ links from visitors in the sidebar only', () => {
    expect(hrefs(mainNav('sidebar', { signedIn: false }))).toEqual(['/t', '/cf']);
    expect(hrefs(mainNav('tabs', { signedIn: false }))).toEqual([
      '/t',
      '/cf',
      '/t/new',
      '/u/tables',
    ]);
  });

  // Admin is in the account menu on every surface (the nav is the same for admins and members).
  it('never lists Admin', () => {
    expect(hrefs(mainNav('tabs', { signedIn: true }))).not.toContain('/admin');
    expect(hrefs(mainNav('sidebar', { signedIn: true }))).not.toContain('/admin');
  });
});
