import type { IconName } from '#lib/icons/names.js';
import { isUnder } from '#lib/navigation/main-nav.js';
import { m } from '#lib/paraglide/messages.js';

/** Which directories are on for the person reading (the layout's `directories`). */
export type DirectorySwitches = { systems: boolean; gms: boolean };

export interface DirectoryLink {
  href: `/${string}`;
  icon: IconName;
  /** The open sidebar's and the sheet's name. */
  label: () => string;
  /** The rail's and the tab bar's name. */
  shortLabel: () => string;
  /** The sheet's one line under the name. */
  description: () => string;
  /** The page you are on is in this directory: its list or one of its items. */
  current: (pathname: string) => boolean;
}

// In the menus' order: Sistemas, Lugares, Quem mestra. Places join with their page.
const DIRECTORY_NAV: readonly (DirectoryLink & { key: keyof DirectorySwitches })[] = [
  {
    key: 'systems',
    href: '/systems',
    icon: 'game-icons:book-cover',
    label: m.nav_directory_systems,
    shortLabel: m.nav_directory_systems_short,
    description: m.nav_directory_systems_description,
    current: (pathname) => isUnder(pathname, '/systems') || isUnder(pathname, '/s'),
  },
  {
    key: 'gms',
    href: '/gamemasters',
    icon: 'game-icons:pointy-hat',
    label: m.nav_directory_gms,
    shortLabel: m.nav_directory_gms,
    description: m.nav_directory_gms_description,
    // A profile is anyone's, not only a person who runs games: only the list is this directory.
    current: (pathname) => isUnder(pathname, '/gamemasters'),
  },
];

/** The directory links to draw, in order: only the ones whose flag is on. */
export function directoryNav(switches: DirectorySwitches): DirectoryLink[] {
  return DIRECTORY_NAV.filter((link) => switches[link.key]);
}
