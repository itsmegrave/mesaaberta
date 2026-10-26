import type { IconName } from '#lib/icons/names.js';
import { m } from '#lib/paraglide/messages.js';

/**
 * Whether `pathname` is the page `base` or one under it (`/tables` and `/tables/new`, never `/tablespoon`), unless
 * it is one of the `except` pages.
 */
export function isUnder(pathname: string, base: string, except: readonly string[] = []): boolean {
  if (except.includes(pathname)) return false;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Who a link is for: everyone or signed-in members. Admin lives in the account menu. */
export type Audience = 'everyone' | 'members';

/** Where the main navigation is drawn: the desktop sidebar (open or as a rail) or the phone tab bar. */
export type Surface = 'sidebar' | 'tabs';

export interface MainNavLink {
  href: '/tables' | '/crowdfunding' | '/tables/new' | '/u/tables';
  icon: IconName;
  /** The open sidebar's label. */
  label: () => string;
  /** The rail's label, which may be shorter or break the word. */
  railLabel: () => string;
  /** The tab bar's label. */
  tabLabel: () => string;
  /** What the tab is announced as when its label is a short form. */
  tabAriaLabel?: () => string;
  /** The page you are on is in this section. */
  current: (pathname: string) => boolean;
  audience: Audience;
  /** The call to action, drawn filled. */
  primary?: boolean;
}

// Parceiros has no link in the app chrome; the footer lists it.
export const MAIN_NAV: readonly MainNavLink[] = [
  {
    href: '/tables',
    icon: 'game-icons:tavern-sign',
    label: m.nav_tables,
    railLabel: m.nav_tables,
    tabLabel: m.nav_tables,
    // The list and every table's own page (`/t/<slug>`), but not the form that opens one.
    current: (pathname) => isUnder(pathname, '/tables', ['/tables/new']) || isUnder(pathname, '/t'),
    audience: 'everyone',
  },
  {
    href: '/crowdfunding',
    icon: 'game-icons:open-treasure-chest',
    label: m.nav_crowdfunding,
    // The rail is narrow, so it breaks the word where it can (a soft hyphen in the message).
    railLabel: m.nav_crowdfunding_rail,
    // The short label fits the bar, the full name is what is announced.
    tabLabel: m.nav_crowdfunding_short,
    tabAriaLabel: m.nav_crowdfunding_label,
    current: (pathname) => isUnder(pathname, '/crowdfunding'),
    audience: 'everyone',
  },
  {
    href: '/tables/new',
    icon: 'game-icons:dice-twenty-faces-twenty',
    label: m.nav_open_table,
    railLabel: m.nav_open_table_short,
    tabLabel: m.nav_open_table_short,
    current: (pathname) => pathname === '/tables/new',
    audience: 'members',
    primary: true,
  },
  {
    href: '/u/tables',
    icon: 'game-icons:tabletop-players',
    label: m.nav_my_tables,
    railLabel: m.nav_my_tables,
    tabLabel: m.nav_my_tables,
    // Only the tables' own pages: the profile and the rest of the account are not "Minhas mesas".
    current: (pathname) => isUnder(pathname, '/u/tables'),
    audience: 'members',
  },
];

/**
 * The links a surface lists in order. The sidebar hides the members' links from visitors; the tab
 * bar always shows them (they lead to sign-in). Admin is never listed: it is in the account menu.
 */
export function mainNav(surface: Surface, viewer: { signedIn: boolean }): MainNavLink[] {
  return MAIN_NAV.filter((link) => {
    if (link.audience === 'members') return surface === 'tabs' || viewer.signedIn;
    return true;
  });
}
