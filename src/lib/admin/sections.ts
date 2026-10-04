import type { IconName } from '$lib/icons/names';
import { m } from '$lib/paraglide/messages';

export type AdminCounts = { reports: number; queue: number; connections: number; events: number };
export type AdminSection = { path: string; label: string; icon: IconName; count?: number };
export type AdminGroup = { key: string; label: string; sections: AdminSection[] };

/**
 * The admin's sections in their groups, with what waits on an admin counted beside them. One list
 * for the column on a desktop and the menu on a phone.
 */
export function adminGroups(counts: AdminCounts): AdminGroup[] {
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
        { path: '/admin/users', label: m.admin_profile_list(), icon: 'game-icons:meeple' },
        { path: '/admin/catalog', label: m.admin_nav_catalog(), icon: 'tag' },
      ],
    },
    {
      key: 'communication',
      label: m.admin_group_communication(),
      sections: [
        { path: '/admin/notifications', label: m.admin_nav_notifications(), icon: 'megaphone' },
        // The path of the connections stays `/admin/instagram`: Meta's OAuth redirect URI points at its callback.
        {
          path: '/admin/instagram',
          label: m.admin_nav_connections(),
          icon: 'globe',
          count: counts.connections,
        },
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

/** The section a route belongs to (the detail pages belong to the list they open from). */
export function sectionOf(groups: AdminGroup[], route: string | null) {
  const all = groups.flatMap((group) => group.sections);
  return all.find((section) =>
    section.path === '/admin' ? route === '/admin' : !!route?.startsWith(section.path),
  );
}
