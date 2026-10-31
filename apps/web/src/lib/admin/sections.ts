import type { IconName } from '#lib/icons/names.js';
import { DRAWINGS } from '#lib/icons/drawings.generated.js';
import { m } from '#lib/paraglide/messages.js';

export type AdminCounts = {
  reports: number;
  queue: number;
  connections: number;
  events: number;
  partners: number;
  places: number;
  /** Places reports hid: the admins' high alert, counted in red beside "Lugares". */
  hiddenPlaces: number;
};
export type AdminSection = {
  path: string;
  /** The route id that marks this section, when it is not the path's own (a param route). */
  routeId?: string;
  label: string;
  icon: IconName;
  count?: number;
  /** The count is a high alert, drawn in the danger tone. */
  alert?: boolean;
};
export type AdminGroup = { key: string; label: string; sections: AdminSection[] };
/** An installed extension's own section (the admin layout's `adminSections`). */
export type ExtensionSection = { path: string; label: string; icon: string };

const iconOf = (name: string): IconName =>
  Object.hasOwn(DRAWINGS, name) ? (name as IconName) : 'globe';

/**
 * The admin's sections in their groups, with what waits on an admin counted beside them. One list
 * for the column on a desktop and the menu on a phone. The connections page is there only when an
 * installed extension has a panel on it: `connectionsPath` is the address of the first. An extension
 * with a section of its own (`extensions`) is listed under Communication.
 */
export function adminGroups(
  counts: AdminCounts,
  connectionsPath: string | null,
  extensions: readonly ExtensionSection[] = [],
  { badges = false }: { badges?: boolean } = {},
): AdminGroup[] {
  return [
    {
      key: 'overview',
      label: m.admin_group_overview(),
      sections: [{ path: '/admin', label: m.admin_nav_overview(), icon: 'category' }],
    },
    {
      key: 'moderation',
      label: m.admin_group_moderation(),
      sections: [
        {
          path: '/admin/reports',
          label: m.admin_reports_title(),
          icon: 'flag',
          count: counts.reports,
        },
        { path: '/admin/queue', label: m.admin_nav_queue(), icon: 'check', count: counts.queue },
      ],
    },
    {
      key: 'content',
      label: m.admin_group_content(),
      sections: [
        { path: '/admin/tables', label: m.admin_tables(), icon: 'game-icons:tavern-sign' },
        {
          path: '/admin/crowdfunding',
          label: m.admin_nav_crowdfunding(),
          icon: 'game-icons:open-treasure-chest',
        },
        {
          path: '/admin/partners',
          label: m.admin_nav_partners(),
          icon: 'game-icons:trade',
          count: counts.partners,
        },
        {
          path: '/admin/places',
          label: m.admin_nav_places(),
          icon: 'game-icons:position-marker',
          count: counts.places + counts.hiddenPlaces,
          alert: counts.hiddenPlaces > 0,
        },
        { path: '/admin/users', label: m.admin_profile_list(), icon: 'game-icons:meeple' },
        { path: '/admin/catalog', label: m.admin_nav_catalog(), icon: 'tag' },
        ...(badges
          ? [{ path: '/admin/badges', label: m.admin_nav_badges(), icon: 'sparkles' as const }]
          : []),
      ],
    },
    {
      key: 'communication',
      label: m.admin_group_communication(),
      sections: [
        { path: '/admin/notifications', label: m.admin_nav_notifications(), icon: 'megaphone' },
        ...extensions.map((section) => ({
          path: section.path,
          routeId: '/admin/[ext]',
          label: section.label,
          icon: iconOf(section.icon),
        })),
        ...(connectionsPath
          ? [
              {
                path: connectionsPath,
                routeId: '/admin/[ext]',
                label: m.admin_nav_connections(),
                icon: 'globe' as const,
                count: counts.connections,
              },
            ]
          : []),
      ],
    },
    {
      key: 'log',
      label: m.admin_group_log(),
      sections: [
        { path: '/admin/audit', label: m.admin_audit_title(), icon: 'clock' },
        {
          path: '/admin/events',
          label: m.admin_nav_events(),
          icon: 'refresh-cw',
          count: counts.events,
        },
      ],
    },
  ];
}

/**
 * The section a route belongs to (the detail pages belong to the list they open from). Sections
 * that share a param route (the extensions' `/admin/[ext]`) are told apart by the page's `path`.
 */
export function sectionOf(groups: AdminGroup[], route: string | null, path?: string) {
  const all = groups.flatMap((group) => group.sections);
  const shared = (section: AdminSection) =>
    all.filter((other) => other.routeId && other.routeId === section.routeId).length > 1;
  return all.find((section) =>
    section.path === '/admin'
      ? route === '/admin'
      : !!route?.startsWith(section.routeId ?? section.path) &&
        (!shared(section) || path === undefined || path.startsWith(section.path)),
  );
}
