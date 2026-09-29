import { connectionStringFrom, createDb, type DatabaseEnv } from '../db/client';
import type { Logger } from '../logger';
import { pruneNotifications } from '../notifications/service';
import { pruneEvents, sweepEvents } from './dispatcher';
import type { Handler } from './types';

type Deps = { open?: typeof createDb; handlers: readonly Handler[]; log: Logger };

/**
 * One run of the sweeper, called by the Cron Trigger: opens the database, dispatches the events
 * that are due (retries after backoff, and any whose first dispatch never happened), and always
 * closes the connection. It also deletes the events and notifications past their retention period. Does nothing
 * without a database. Returns how many events it tried.
 */
export async function runSweeper(
  env: DatabaseEnv,
  { open = createDb, handlers, log }: Deps,
): Promise<number> {
  const connectionString = connectionStringFrom(env);
  if (!connectionString) return 0;

  const { db, close } = open(connectionString);
  try {
    const swept = await sweepEvents(db, handlers);
    if (swept > 0) log.info('event sweep', { swept });
    const pruned = await pruneEvents(db);
    if (pruned > 0) log.info('event prune', { pruned });
    const expired = await pruneNotifications(db);
    if (expired > 0) log.info('notification prune', { expired });
    return swept;
  } finally {
    await close();
  }
}
