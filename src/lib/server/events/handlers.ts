import type { Handler } from './types';
import { inviteHandler, type InviteEnv } from './invites';
import { notificationHandler } from './notifications';
import { announcementHandler } from './announcements';

/**
 * Every handler that reacts to domain events. Each is idempotent (see `Handler`), so the sweeper
 * can retry it safely. Secrets are only available at runtime, so handlers are made from the
 * request or Cron environment rather than imported as a process-global client. The bell needs
 * only the database, so its handlers run whatever the environment has.
 */
export function handlersFor(env: InviteEnv | undefined): readonly Handler[] {
  const handler = inviteHandler(env);
  const bell = [notificationHandler, announcementHandler];
  return handler ? [handler, ...bell] : bell;
}
