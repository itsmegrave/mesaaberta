import { describe, expect, it } from 'vitest';
import { ADMIN_LINK, MAIN_NAV, isUnder, mainNav } from './main-nav';

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

  it('marks the admin pages', () => {
    expect(ADMIN_LINK.current('/admin/users')).toBe(true);
    expect(ADMIN_LINK.current('/administrator')).toBe(false);
  });
});

describe('mainNav', () => {
  const hrefs = (links: { href: string }[]) => links.map((item) => item.href);

  it('hides the members’ links from visitors in the sidebar only', () => {
    expect(hrefs(mainNav('sidebar', { signedIn: false, isAdmin: false }))).toEqual(['/t', '/cf']);
    expect(hrefs(mainNav('tabs', { signedIn: false, isAdmin: false }))).toEqual([
      '/t',
      '/cf',
      '/t/new',
      '/u/tables',
    ]);
  });

  it('adds Admin as a tab for admins, never to the sidebar list', () => {
    expect(hrefs(mainNav('tabs', { signedIn: true, isAdmin: true }))).toContain('/admin');
    expect(hrefs(mainNav('sidebar', { signedIn: true, isAdmin: true }))).not.toContain('/admin');
  });
});
