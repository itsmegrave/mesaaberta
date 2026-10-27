import { checkDatabase, type DatabaseHealth } from '@mesaaberta/core/server/db/health';
import { workerHealth, type WorkerHealth } from '@mesaaberta/core/server/events/heartbeat';
import {
  connectionStringFrom,
  createDb as openDb,
  type createDb,
  type DatabaseEnv,
} from '@mesaaberta/core/server/db/client';
import { logger } from '@mesaaberta/core/server/logger';

export type StoreHealth = { database: DatabaseHealth; worker?: WorkerHealth };

/**
 * What the web /healthz reports about the database and the background Worker (read from its last
 * sweep): the api is the one app that opens the database. `not_configured` without a connection
 * string; never throws.
 */
export async function storeHealth(
  env: DatabaseEnv | undefined,
  open: typeof createDb = openDb,
): Promise<StoreHealth> {
  const connectionString = connectionStringFrom(env);
  if (!connectionString) return { database: 'not_configured' };
  const { db, close } = open(connectionString);
  try {
    const database = await checkDatabase(db, logger);
    return database === 'ok' ? { database, worker: await workerHealth(db) } : { database };
  } finally {
    await close().catch(() => undefined);
  }
}
