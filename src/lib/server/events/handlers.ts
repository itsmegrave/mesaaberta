import { analyticsHandlers, type AnalyticsEnv } from '../analytics';
import { instagramQueueHandler } from '../instagram/publisher';
import type { Handler } from './types';
import { inviteHandler, type InviteEnv } from './invites';
import { notificationHandler } from './notifications';
import { announcementHandler } from './announcements';
import { moderationHandler } from './moderation';
import { banMailHandler } from './ban-mail';

/**
 * Every handler that reacts to domain events. Each is idempotent (see `Handler`), so the sweeper
 * can retry it safely. Secrets are only available at runtime, so handlers are made from the
 * request or Cron environment rather than imported as a process-global client. The bell needs
 * only the database, so its handlers run whatever the environment has.
 */
export function handlersFor(env: (InviteEnv & AnalyticsEnv) | undefined): readonly Handler[] {
  const handler = inviteHandler(env);
  const bell = [notificationHandler, announcementHandler, moderationHandler, instagramQueueHandler];
  const banMail = banMailHandler(env);
  return [
    ...(handler ? [handler] : []),
    ...(banMail ? [banMail] : []),
    ...bell,
    ...analyticsHandlers(env),
  ];
}
