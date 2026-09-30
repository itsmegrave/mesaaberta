import { publishInstagramPosts } from '../instagram/publisher';
import type { InstagramEnv } from '../instagram/api';
import { connectionStringFrom, createDb, type DatabaseEnv } from '../db/client';
import type { Logger } from '../logger';
import { pruneNotifications } from '../notifications/service';
import { announceChangelog } from '../notifications/changelog';
// Relative, not $lib, and no import.meta.glob: wrangler bundles the Cron Trigger's Worker from here
// without Vite, so it reads the generated module (`pnpm changelog`).
import { parseEntries, type ChangelogEntry } from '../../changelog/entries';
import { ENTRY_FILES } from '../../changelog/entries.generated';
import { pruneEvents, sweepEvents } from './dispatcher';
import type { Handler } from './types';

type Deps = {
  open?: typeof createDb;
  handlers: readonly Handler[];
  log: Logger;
  /** The changelog to announce; the bundled one unless a test says otherwise. */
  changelog?: readonly ChangelogEntry[];
};

/**
 * One run of the sweeper, called by the Cron Trigger: opens the database, dispatches the events
 * that are due (retries after backoff, and any whose first dispatch never happened), and always
 * closes the connection. It also deletes the events and notifications past their retention period,
 * and announces new changelog entries. Does nothing
 * without a database. Returns how many events it tried.
 */
export async function runSweeper(
  env: DatabaseEnv & InstagramEnv,
  { open = createDb, handlers, log, changelog = parseEntries(ENTRY_FILES) }: Deps,
): Promise<number> {
  const connectionString = connectionStringFrom(env);
  if (!connectionString) return 0;

  const { db, close } = open(connectionString);
  try {
    const swept = await sweepEvents(db, handlers);
    if (swept > 0) log.info('event sweep', { swept });
    await publishInstagramPosts(db, env);
    const pruned = await pruneEvents(db);
    if (pruned > 0) log.info('event prune', { pruned });
    const expired = await pruneNotifications(db);
    if (expired > 0) log.info('notification prune', { expired });
    // A deploy with a new changelog entry puts it in everyone's bell on the next run.
    const announced = await announceChangelog(db, changelog);
    if (announced > 0) log.info('changelog announced', { announced });
    return swept;
  } finally {
    await close();
  }
}
