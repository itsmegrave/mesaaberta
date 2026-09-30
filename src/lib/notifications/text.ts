import { m } from '$lib/paraglide/messages';
import { atHandle } from '$lib/profile/handle';
import {
  ANNOUNCEMENT_ICONS,
  isNotificationType,
  NOTIFICATION_KINDS,
  type NotificationIcon,
} from './kinds';

/** What the bell and the feed need of a notification to word it. */
export type Shown = {
  type: string;
  icon: string | null;
  title: string | null;
  body: string | null;
  metadata: Record<string, string>;
  actor: string | null;
};

/** The sentence a notification is shown as. An announcement is its own title (and body). */
export function notificationText(item: Shown): string {
  if (item.title) return item.body ? `${item.title}: ${item.body}` : item.title;

  const table = item.metadata.title ?? '';
  const player = item.actor ? atHandle(item.actor) : m.notification_someone();
  if (!isNotificationType(item.type)) return m.notification_unknown();
  switch (item.type) {
    case 'table_updated':
      return m.notification_table_updated({ table });
    case 'table_cancelled':
      return m.notification_table_cancelled({ table });
    case 'session_reminder':
      return m.notification_session_reminder({ table });
    case 'join_requested':
      return m.notification_join_requested({ player, table });
    case 'join_approved':
      return m.notification_join_approved({ table });
    case 'join_declined':
      return m.notification_join_declined({ table });
    case 'player_joined':
      return m.notification_player_joined({ player, table });
    case 'player_left':
      return m.notification_player_left({ player, table });
    case 'player_removed':
      return m.notification_player_removed({ table });
    case 'rating_received':
      return m.notification_rating_received({ table });
    case 'rating_prompt':
      return m.notification_rating_prompt({ table });
    case 'catalog_suggestion_approved':
      return m.notification_catalog_suggestion_approved();
    case 'catalog_suggestion_merged':
      return m.notification_catalog_suggestion_merged();
    case 'catalog_suggestion_rejected':
      return m.notification_catalog_suggestion_rejected();
    case 'report_filed_admin':
      return m.notification_report_filed_admin();
    case 'report_resolved':
      return m.notification_report_resolved();
    case 'moderation_notice':
      return m.notification_moderation_notice();
    case 'system_announcement':
      return m.notification_unknown();
  }
}

const ICONS = new Set<string>([
  ...Object.values(NOTIFICATION_KINDS).map((kind) => kind.icon),
  ...ANNOUNCEMENT_ICONS,
]);

/** The notification's own icon when it is one the bell can draw, else its type's. */
export function notificationIcon(item: Pick<Shown, 'type' | 'icon'>): NotificationIcon {
  if (item.icon && ICONS.has(item.icon)) return item.icon as NotificationIcon;
  return isNotificationType(item.type) ? NOTIFICATION_KINDS[item.type].icon : 'megaphone';
}
