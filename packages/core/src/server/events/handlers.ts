import { analyticsHandlers, type AnalyticsEnv } from '../analytics';
import { extensionHandlers } from '../extensions/index';
import { socialFor, type SocialEnv } from '../social';
import type { Handler } from './types';
import { inviteHandler, type InviteEnv } from './invites';
import { notificationHandler } from './notifications';
import { announcementHandler } from './announcements';
import { moderationHandler } from './moderation';
import { placeAlertHandler } from './place-alerts';
import { catalogHandler } from './catalog';
import { badgeHandler, badgeNoticeHandler } from '../badges/handlers';
import { banMailHandler } from './ban-mail';
import { closeReminderMailHandler } from './close-reminder-mail';
import { followsHandler } from './follows';
import {
  playerInvitationMailHandler,
  playerInvitationNotificationHandler,
} from './player-invitations';
import { partnerInvitationMailHandler, partnerOwnerNotificationHandler } from './partner-owners';

/**
 * The handlers that write the bell's notifications from table, announcement, moderation and
 * catalog events. They need only the database, and are the second class of handlers the queue can
 * deliver (`api_events_queue_bell`, ADR 0003 stage 3).
 */
export const bellHandlers: readonly Handler[] = [
  notificationHandler,
  announcementHandler,
  moderationHandler,
  placeAlertHandler,
  catalogHandler,
  playerInvitationNotificationHandler,
  partnerOwnerNotificationHandler,
  badgeHandler,
  badgeNoticeHandler,
  followsHandler,
];

/**
 * The handlers that send e-mail: calendar invites, the notice of a ban, the invitations and the
 * reminders to close a session (with the rating request that follows). The third class the
 * queue can deliver (`api_events_queue_mail`, ADR 0003 stage 3). By name, because each handler
 * exists only where its mail settings are configured.
 */
export const MAIL_HANDLER_NAMES = [
  'calendar-invites-v1',
  'ban-mail-v1',
  'player-invitation-mail-v1',
  'partner-invitation-mail-v1',
  'close-reminder-mail-v1',
] as const;

/**
 * Every handler that reacts to domain events. Each is idempotent (see `Handler`), so the sweeper
 * can retry it safely. Secrets are only available at runtime, so handlers are made from the
 * request or Cron environment rather than imported as a process-global client. The bell needs
 * only the database, so its handlers run whatever the environment has.
 */
export function handlersFor(
  env: (InviteEnv & AnalyticsEnv & SocialEnv) | undefined,
): readonly Handler[] {
  const handler = inviteHandler(env);
  const bell = [...bellHandlers, ...socialFor(env).handlers];
  const banMail = banMailHandler(env);
  const playerInvitations = playerInvitationMailHandler(env);
  const partnerInvitations = partnerInvitationMailHandler(env);
  const closeReminders = closeReminderMailHandler(env);
  // The bell first: a slow or failing mail provider must not hold up the in-app notice.
  return [
    ...bell,
    ...(handler ? [handler] : []),
    ...(banMail ? [banMail] : []),
    ...(playerInvitations ? [playerInvitations] : []),
    ...(partnerInvitations ? [partnerInvitations] : []),
    ...(closeReminders ? [closeReminders] : []),
    ...extensionHandlers(),
    ...analyticsHandlers(env),
  ];
}
