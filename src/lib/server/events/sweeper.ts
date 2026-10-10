import { socialFor, type SocialEnv } from '../social';
import type { InstagramEnv } from '../instagram/api';
import { connectionStringFrom, createDb, type DatabaseEnv } from '../db/client';
import type { Logger } from '../logger';
import { closeElapsedTables } from '../tables/lifecycle';
import { pruneNotifications } from '../notifications/service';
import { pruneTableChats } from '../messages/retention';
import { pollOutbox } from '@mesaaberta/events';
import { pruneEvents, sweepEvents } from './dispatcher';
import { createEventExecutor } from './executor';
import { liftExpiredBans } from '../moderation/bans';
import type { Handler } from './types';

/**
 * `EVENT_POLLER=true` sweeps through the transport contract (the Postgres poller and the executor,
 * ADR 0003) instead of calling the dispatcher directly. It claims, runs and records the same way, so
 * the default stays the direct path until the poller has run clean beside it.
 */
type PollerEnv = { EVENT_POLLER?: string } & SocialEnv;

type Deps = {
  open?: typeof createDb;
  handlers: readonly Handler[];
  log: Logger;
};

/**
 * One run of the sweeper, called by the Cron Trigger: opens the database, dispatches the events
 * that are due (retries after backoff, and any whose first dispatch never happened), and always
 * closes the connection. Before that it asks the GM of every table whose session is over whether it
 * happened (`closeElapsedTables`) and lifts the temporary bans that ended. It also deletes the events and notifications past their retention period,
 * and table chats past their retention period. Does nothing without a database. Returns how many events it tried.
 */
export async function runSweeper(
  env: DatabaseEnv & InstagramEnv & PollerEnv,
  { open = createDb, handlers, log }: Deps,
): Promise<number> {
  const connectionString = connectionStringFrom(env);
  if (!connectionString) return 0;

  const { db, close } = open(connectionString);
  try {
    const now = new Date();
    // First, so the GM's question goes out in this very run: its events are due at once.
    const closed = await closeElapsedTables(db, now);
    if (closed.length > 0) log.info('tables awaiting confirmation', { closed: closed.length });
    // Temporary bans whose time is up; their events go out in this run too.
    const lifted = await liftExpiredBans(db, now);
    if (lifted.length > 0) log.info('bans lifted', { lifted: lifted.length });
    const swept =
      env.EVENT_POLLER === 'true'
        ? await sweepThroughPoller(db, handlers, now, log)
        : await sweepEvents(db, handlers, now, 50, log, { clock: () => new Date() });
    if (swept > 0) log.info('event sweep', { swept });
    await socialFor(env).publishDue(db, env);
    const pruned = await pruneEvents(db);
    if (pruned > 0) log.info('event prune', { pruned });
    const expired = await pruneNotifications(db);
    if (expired > 0) log.info('notification prune', { expired });
    const chats = await pruneTableChats(db);
    if (chats > 0) log.info('table chat prune', { chats });
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
    log.info('event poll', { retry: summary.retry, failed: summary.failed });
  }
  return summary.tried;
}
