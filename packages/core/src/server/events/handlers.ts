import { analyticsHandlers, type AnalyticsEnv } from '../analytics';
import { socialFor, type SocialEnv } from '../social';
import type { Handler } from './types';
import { inviteHandler, type InviteEnv } from './invites';
import { notificationHandler } from './notifications';
import { announcementHandler } from './announcements';
import { moderationHandler } from './moderation';
import { catalogHandler } from './catalog';
import { banMailHandler } from './ban-mail';
import {
  playerInvitationMailHandler,
  playerInvitationNotificationHandler,
} from './player-invitations';

/**
 * The handlers that write the bell's notifications from table, announcement, moderation and
 * catalog events. They need only the database, and are the second class of handlers the queue can
 * deliver (`api_events_queue_bell`, ADR 0003 stage 3).
 */
export const bellHandlers: readonly Handler[] = [
  notificationHandler,
  announcementHandler,
  moderationHandler,
  catalogHandler,
  playerInvitationNotificationHandler,
];

/**
 * The handlers that send e-mail: calendar invites and the notice of a ban. The third class the
 * queue can deliver (`api_events_queue_mail`, ADR 0003 stage 3). By name, because each handler
 * exists only where its mail settings are configured.
 */
export const MAIL_HANDLER_NAMES = [
  'calendar-invites-v1',
  'ban-mail-v1',
  'player-invitation-mail-v1',
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
  return [
    ...(handler ? [handler] : []),
    ...(banMail ? [banMail] : []),
    ...(playerInvitations ? [playerInvitations] : []),
    ...bell,
    ...analyticsHandlers(env),
  ];
}
