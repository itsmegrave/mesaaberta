// Relative imports only: the events handler that writes notifications is bundled into the Cron
// Trigger's Worker without SvelteKit's `$lib` alias.

export const NOTIFICATION_CATEGORIES = [
  'table',
  'registration',
  'rating',
  'catalog',
  'moderation',
  'system',
  'messages',
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

/** The icons an admin can pick for an announcement. */
export const ANNOUNCEMENT_ICONS = [
  'megaphone',
  'wrench',
  'alert-triangle',
  'sparkles',
  'gift',
  'info',
] as const satisfies readonly NotificationIcon[];

export type AnnouncementIcon = (typeof ANNOUNCEMENT_ICONS)[number];

/** How an announcement reads: news, a warning (maintenance) or plain information. */
export const ANNOUNCEMENT_TONES = ['info', 'warning', 'announcement'] as const;

export type AnnouncementTone = (typeof ANNOUNCEMENT_TONES)[number];

/** The icon an announcement gets when the admin picks none. */
export const TONE_ICON: Record<AnnouncementTone, AnnouncementIcon> = {
  info: 'info',
  warning: 'alert-triangle',
  announcement: 'megaphone',
};

/** Who an announcement goes to. Every audience is limited to active accounts. */
export const ANNOUNCEMENT_AUDIENCES = [
  'all_active_users',
  'game_masters',
  'active_players',
  'specific_user',
] as const;

export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

/**
 * Every kind of notification, its category and its icon. Only the table, registration and rating
 * ones are written today; the catalog, moderation and system ones are for the slices that add
 * those events, so the feed and its filters already know them.
 */
export const NOTIFICATION_KINDS = {
  table_updated: { category: 'table', icon: 'calendar' },
  table_cancelled: { category: 'table', icon: 'cancel' },
  session_reminder: { category: 'table', icon: 'calendar' },
  join_requested: { category: 'registration', icon: 'user-plus' },
  join_approved: { category: 'registration', icon: 'user-check' },
  join_declined: { category: 'registration', icon: 'user-x' },
  player_joined: { category: 'registration', icon: 'user-plus' },
  player_left: { category: 'registration', icon: 'user-minus' },
  player_removed: { category: 'registration', icon: 'user-minus' },
  rating_received: { category: 'rating', icon: 'star' },
  rating_prompt: { category: 'rating', icon: 'star' },
  catalog_suggestion_approved: { category: 'catalog', icon: 'tag' },
  catalog_suggestion_merged: { category: 'catalog', icon: 'tag' },
  catalog_suggestion_rejected: { category: 'catalog', icon: 'tag' },
  report_filed_admin: { category: 'moderation', icon: 'shield' },
  report_resolved: { category: 'moderation', icon: 'shield' },
  moderation_notice: { category: 'moderation', icon: 'shield' },
  system_announcement: { category: 'system', icon: 'megaphone' },
  message_received: { category: 'messages', icon: 'message' },
} as const satisfies Record<string, { category: NotificationCategory; icon: NotificationIcon }>;

export type NotificationType = keyof typeof NOTIFICATION_KINDS;

export const isNotificationType = (type: string): type is NotificationType =>
  Object.hasOwn(NOTIFICATION_KINDS, type);

/** What a table notification carries in `metadata`: enough to word it and link to the table. */
export type TableMetadata = { tableId: string; slug: string; title: string };
