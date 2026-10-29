// Relative imports only: the events handler that writes notifications is bundled into the Cron
// Trigger's Worker without SvelteKit's `#lib` alias.

export const NOTIFICATION_CATEGORIES = [
  'table',
  'registration',
  'rating',
  'catalog',
  'moderation',
  'system',
  'messages',
  'achievements',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** The icons the bell can draw. A notification's own `icon` wins over its type's. */
export type NotificationIcon =
  | 'calendar'
  | 'cancel'
  | 'user-plus'
  | 'user-check'
  | 'user-x'
  | 'user-minus'
  | 'star'
  | 'tag'
  | 'shield'
  | 'megaphone'
  | 'wrench'
  | 'alert-triangle'
  | 'sparkles'
  | 'gift'
  | 'info'
  | 'message';

// The announcement vocabulary is part of the event contracts (`SystemAnnouncementSent`).
export {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_ICONS,
  ANNOUNCEMENT_TONES,
  type AnnouncementAudience,
  type AnnouncementIcon,
  type AnnouncementTone,
} from '@mesaaberta/contracts';
import {
  ANNOUNCEMENT_ICONS,
  type AnnouncementIcon,
  type AnnouncementTone,
} from '@mesaaberta/contracts';

// An announcement can only use an icon the bell can draw.
ANNOUNCEMENT_ICONS satisfies readonly NotificationIcon[];

/** The icon an announcement gets when the admin picks none. */
export const TONE_ICON: Record<AnnouncementTone, AnnouncementIcon> = {
  info: 'info',
  warning: 'alert-triangle',
  announcement: 'megaphone',
};

/**
 * Every kind of notification, its category and its icon. Only the table, registration and rating
 * ones are written today; the catalog, moderation and system ones are for the slices that add
 * those events, so the feed and its filters already know them.
 */
export const NOTIFICATION_KINDS = {
  table_updated: { category: 'table', icon: 'calendar' },
  table_cancelled: { category: 'table', icon: 'cancel' },
  session_reminder: { category: 'table', icon: 'calendar' },
  session_confirmation: { category: 'table', icon: 'calendar' },
  player_invited: { category: 'registration', icon: 'user-plus' },
  invitation_accepted: { category: 'registration', icon: 'user-check' },
  invitation_declined: { category: 'registration', icon: 'user-x' },
  invitation_expired: { category: 'registration', icon: 'cancel' },
  invitation_cancelled: { category: 'registration', icon: 'cancel' },
  join_requested: { category: 'registration', icon: 'user-plus' },
  join_approved: { category: 'registration', icon: 'user-check' },
  join_declined: { category: 'registration', icon: 'user-x' },
  player_joined: { category: 'registration', icon: 'user-plus' },
  player_left: { category: 'registration', icon: 'user-minus' },
  player_removed: { category: 'registration', icon: 'user-minus' },
  // A seat freed up and the first in the lista de espera moved up: seated, or asked the GM for it.
  waitlist_seated: { category: 'registration', icon: 'user-check' },
  waitlist_requested: { category: 'registration', icon: 'user-plus' },
  rating_received: { category: 'rating', icon: 'star' },
  rating_prompt: { category: 'rating', icon: 'star' },
  badge_earned: { category: 'achievements', icon: 'sparkles' },
  followed_table_opened: { category: 'table', icon: 'calendar' },
  followed_seat_opened: { category: 'table', icon: 'calendar' },
  follow_started: { category: 'system', icon: 'user-plus' },
  catalog_suggestion_approved: { category: 'catalog', icon: 'tag' },
  catalog_suggestion_merged: { category: 'catalog', icon: 'tag' },
  catalog_suggestion_rejected: { category: 'catalog', icon: 'tag' },
  report_filed_admin: { category: 'moderation', icon: 'shield' },
  report_resolved: { category: 'moderation', icon: 'shield' },
  moderation_notice: { category: 'moderation', icon: 'shield' },
  // Reports hid a place: a high alert for admins, pinned atop the bell until it is read.
  place_hidden_alert: { category: 'moderation', icon: 'alert-triangle' },
  partner_invited: { category: 'system', icon: 'user-plus' },
  partner_invitation_accepted: { category: 'system', icon: 'user-check' },
  partner_invitation_declined: { category: 'system', icon: 'user-x' },
  partner_owner_removed: { category: 'system', icon: 'user-minus' },
  place_host_invited: { category: 'system', icon: 'user-plus' },
  place_host_invitation_accepted: { category: 'system', icon: 'user-check' },
  place_host_invitation_declined: { category: 'system', icon: 'user-x' },
  place_host_removed: { category: 'system', icon: 'user-minus' },
  system_announcement: { category: 'system', icon: 'megaphone' },
  message_received: { category: 'messages', icon: 'message' },
} as const satisfies Record<string, { category: NotificationCategory; icon: NotificationIcon }>;

export type NotificationType = keyof typeof NOTIFICATION_KINDS;

export const isNotificationType = (type: string): type is NotificationType =>
  Object.hasOwn(NOTIFICATION_KINDS, type);

/**
 * What a table notification carries in `metadata`: enough to word it and link to the table. A
 * change notice also says which fields changed (`changed`, comma-separated) and, when the start
 * moved, the old and new start as ISO times, so each viewer reads them in their own timezone. A
 * session reminder carries the start the same way, and which one it is (`24h` or `1h` before).
 */
export type TableMetadata = {
  tableId: string;
  slug: string;
  title: string;
  changed?: string;
  startsAtFrom?: string;
  startsAtTo?: string;
  startsAt?: string;
  window?: '24h' | '1h';
};

/** The fields a change notice names, in the order it names them. Only what players see. */
export const TABLE_NOTICE_FIELDS = [
  'startsAt',
  'timezone',
  'recurrence',
  'until',
  'durationMinutes',
  'modality',
  'locationArea',
  'joinDetails',
  'title',
  'kind',
  'description',
  'extraInfo',
] as const;
