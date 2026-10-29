import { expireInvitations } from '../invitations/service';
import { socialFor, type SocialEnv } from '../social';
import { connectionStringFrom, createDb, type DatabaseEnv } from '../db/client';
import type { Logger } from '../logger';
import { closeElapsedTables } from '../tables/lifecycle';
import { pruneNotifications } from '../notifications/service';
import { sendSessionReminders } from '../notifications/reminders';
import { CLOSE_REMINDERS_FLAG, remindToClose } from '../tables/close-reminders';
import { pruneMailDeliveries } from '../mail/once';
import { pruneAuthAttempts } from '../auth/attempt-limit';
import { flagsFromEnv } from '../flags/env';
import { pruneTableChats } from '../messages/retention';
import { pollOutbox } from '@mesaaberta/events';
import { pruneEvents, sweepEvents } from './dispatcher';
import { reportDelay } from './delay';
import { createEventExecutor } from './executor';
import { recordHeartbeat, SWEEPER_HEARTBEAT } from './heartbeat';
import { buildInfoOf, type BuildEnv } from '../build-info';
import { liftExpiredBans } from '../moderation/bans';
import type { Handler } from './types';

/**
 * `EVENT_POLLER=true` sweeps through the transport contract (the Postgres poller and the executor,
 * ADR 0003) instead of calling the dispatcher directly. It claims, runs and records the same way, so
 * the default stays the direct path until the poller has run clean beside it.
 */
type PollerEnv = { EVENT_POLLER?: string } & SocialEnv & BuildEnv & FlagsEnv;

/** The GrowthBook settings the sweeper reads its own flags with (`use_session_close_reminders`). */
type FlagsEnv = { GROWTHBOOK_API_HOST?: string; GROWTHBOOK_CLIENT_KEY?: string };

type Deps = {
  open?: typeof createDb;
  /** Whether a GM gets the reminders to close a session; GrowthBook by default. */
  closeReminders?: (gm: { id: string; isAdmin: boolean }) => Promise<boolean>;
  handlers: readonly Handler[];
  log: Logger;
};

/**
 * One run of the sweeper, called by the Cron Trigger: opens the database, dispatches the events
 * that are due (retries after backoff, and any whose first dispatch never happened), and always
 * closes the connection. Before that it asks the GM of every table whose session is over whether it
 * happened (`closeElapsedTables`), lifts the temporary bans that ended and sends the session reminders
 * that are due (`sendSessionReminders`) and the e-mails that ask a GM to answer, or the close in their
 * place (`remindToClose`). It also deletes the events, notifications and table chats past their
 * retention period, and the sign-in attempts older than a day. Does nothing without a database.
 * Returns how many events it tried.
 */
export async function runSweeper(
  env: DatabaseEnv & PollerEnv,
  { open = createDb, handlers, log, closeReminders }: Deps,
): Promise<number> {
  const connectionString = connectionStringFrom(env);
  if (!connectionString) return 0;
  const flags = closeReminders ? null : flagsFromEnv(env, {});
  const remindGm =
    closeReminders ??
    ((gm: { id: string; isAdmin: boolean }) => flags!.isEnabled(CLOSE_REMINDERS_FLAG, gm));

  const { db, close } = open(connectionString);
  try {
    const now = new Date();
    // First, so the GM's question goes out in this very run: its events are due at once.
    await expireInvitations(db, { now });
    const closed = await closeElapsedTables(db, now);
    if (closed.length > 0)
      log.info('sweep.tables_awaiting_confirmation', { closed: closed.length });
    // Temporary bans whose time is up; their events go out in this run too.
    const lifted = await liftExpiredBans(db, now);
    if (lifted.length > 0) log.info('sweep.bans_lifted', { lifted: lifted.length });
    // Isolated like the social publish: a failed reminder must not hold up the sweep.
    try {
      const reminded = await sendSessionReminders(db, now);
      if (reminded > 0) log.info('sweep.session_reminders_sent', { reminded });
    } catch (error) {
      log.warn('sweep.session_reminders_failed', { code: 'session_reminders_failed', error });
    }
    // Isolated too, and before the sweep so its e-mails and the close's notices go out in this run.
    try {
      const { reminded, closed } = await remindToClose(db, now, remindGm);
      if (reminded.length > 0 || closed.length > 0)
        log.info('sweep.close_reminders_sent', {
          reminded: reminded.length,
          closed: closed.length,
        });
    } catch (error) {
      log.warn('sweep.close_reminders_failed', { code: 'close_reminders_failed', error });
    }
    const swept =
      env.EVENT_POLLER === 'true'
        ? await sweepThroughPoller(db, handlers, now, log)
        : await sweepEvents(db, handlers, now, 50, log, { clock: () => new Date() });
    if (swept > 0) log.info('sweep.events_swept', { swept });
    // After the sweep: whatever is still late after it ran is worth a person's look.
    await reportDelay(db, new Date(), log);
    // Isolated: an unreadable Instagram token (a rotated INSTAGRAM_TOKEN_KEY) or a Meta outage must
    // not stop the retention pruning below or keep the heartbeat from being recorded.
    try {
      await socialFor(env).publishDue(db, env);
    } catch (error) {
      log.warn('social.publish_failed', { code: 'social_publish_failed', error });
    }
    const pruned = await pruneEvents(db);
    if (pruned > 0) log.info('sweep.events_pruned', { pruned });
    const expired = await pruneNotifications(db);
    if (expired > 0) log.info('sweep.notifications_pruned', { expired });
    const chats = await pruneTableChats(db);
    if (chats > 0) log.info('sweep.table_chats_pruned', { chats });
    const deliveries = await pruneMailDeliveries(db);
    if (deliveries > 0) log.info('sweep.mail_deliveries_pruned', { deliveries });
    const attempts = await pruneAuthAttempts(db);
    if (attempts > 0) log.info('sweep.auth_attempts_pruned', { attempts });
    // Last, so a run that threw before this point does not look alive to /healthz.
    await recordHeartbeat(db, SWEEPER_HEARTBEAT, new Date(), log, buildInfoOf(env));
    return swept;
  } finally {
    await close();
  }
}

async function sweepThroughPoller(
  db: Parameters<typeof sweepEvents>[0],
  handlers: readonly Handler[],
  now: Date,
  log: Logger,
): Promise<number> {
  const summary = await pollOutbox(db, createEventExecutor(db, handlers, { log }), {
    now,
    limit: 50,
  });
  if (summary.retry > 0 || summary.failed > 0) {
    log.info('sweep.event_poll', { retry: summary.retry, failed: summary.failed });
  }
  return summary.tried;
}
