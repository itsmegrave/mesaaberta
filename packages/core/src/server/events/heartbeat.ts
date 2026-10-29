import { eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { workerHeartbeats } from '../db/schema';
import type { Logger } from '../logger';
import type { BuildInfo } from '../build-info';

/** The sweeper runs every five minutes; three missed runs make it stale. */
export const SWEEPER_HEARTBEAT = 'sweeper';
export const HEARTBEAT_STALE_AFTER_MS = 15 * 60 * 1000;

/**
 * Notes that a background job finished a run. Never throws: a heartbeat that cannot be written must
 * not turn a good sweep into a failed one (the health probe just reads it as stale).
 */
export async function recordHeartbeat(
  db: AnyDb,
  name: string,
  now: Date,
  log?: Logger,
  build: BuildInfo = { version: null, revision: null },
) {
  const run = { lastRunAt: now, ...build };
  try {
    await db
      .insert(workerHeartbeats)
      .values({ name, ...run })
      .onConflictDoUpdate({ target: workerHeartbeats.name, set: run });
  } catch (error) {
    log?.warn('worker.heartbeat_failed', { code: 'heartbeat_failed', error });
  }
}

export type WorkerHealth = {
  /** `unknown` until the first run is recorded, or when the table cannot be read. */
  status: 'ok' | 'stale' | 'unknown';
  lastRunAt: string | null;
} & BuildInfo;

const unknown: WorkerHealth = { status: 'unknown', lastRunAt: null, version: null, revision: null };

/** What /healthz reports about the background Worker, which has no route to probe. */
export async function workerHealth(
  db: AnyDb,
  now = new Date(),
  name = SWEEPER_HEARTBEAT,
): Promise<WorkerHealth> {
  try {
    const [row] = await db
      .select({
        lastRunAt: workerHeartbeats.lastRunAt,
        version: workerHeartbeats.version,
        revision: workerHeartbeats.revision,
      })
      .from(workerHeartbeats)
      .where(eq(workerHeartbeats.name, name))
      .limit(1);
    if (!row) return unknown;
    const stale = now.getTime() - row.lastRunAt.getTime() > HEARTBEAT_STALE_AFTER_MS;
    return {
      status: stale ? 'stale' : 'ok',
      lastRunAt: row.lastRunAt.toISOString(),
      version: row.version,
      revision: row.revision,
    };
  } catch {
    return unknown;
  }
}
