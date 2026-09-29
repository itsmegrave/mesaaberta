import type { Handler } from './types';
import { inviteHandler, type InviteEnv } from './invites';
import { notificationHandler } from './notifications';

/**
 * Every handler that reacts to domain events. Each is idempotent (see `Handler`), so the sweeper
 * can retry it safely. Secrets are only available at runtime, so handlers are made from the
 * request or Cron environment rather than imported as a process-global client. The bell needs
 * only the database, so its handler runs whatever the environment has.
 */
export function handlersFor(env: InviteEnv | undefined): readonly Handler[] {
  const handler = inviteHandler(env);
  return handler ? [handler, notificationHandler] : [notificationHandler];
}
