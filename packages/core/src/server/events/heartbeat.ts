import { eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { workerHeartbeats } from '../db/schema';
import type { Logger } from '../logger';

/** The sweeper runs every five minutes; three missed runs make it stale. */
export const SWEEPER_HEARTBEAT = 'sweeper';
export const HEARTBEAT_STALE_AFTER_MS = 15 * 60 * 1000;

/**
 * Notes that a background job finished a run. Never throws: a heartbeat that cannot be written must
 * not turn a good sweep into a failed one (the health probe just reads it as stale).
 */
export async function recordHeartbeat(db: AnyDb, name: string, now: Date, log?: Logger) {
  try {
    await db
      .insert(workerHeartbeats)
      .values({ name, lastRunAt: now })
      .onConflictDoUpdate({ target: workerHeartbeats.name, set: { lastRunAt: now } });
  } catch (error) {
    log?.warn('worker heartbeat failed', { code: 'heartbeat_failed', error });
  }
}

export type WorkerHealth = {
  /** `unknown` until the first run is recorded, or when the table cannot be read. */
  status: 'ok' | 'stale' | 'unknown';
  lastRunAt: string | null;
};

/** What /healthz reports about the background Worker, which has no route to probe. */
export async function workerHealth(
  db: AnyDb,
  now = new Date(),
  name = SWEEPER_HEARTBEAT,
): Promise<WorkerHealth> {
  try {
    const [row] = await db
      .select({ lastRunAt: workerHeartbeats.lastRunAt })
      .from(workerHeartbeats)
      .where(eq(workerHeartbeats.name, name))
      .limit(1);
    if (!row) return { status: 'unknown', lastRunAt: null };
    const stale = now.getTime() - row.lastRunAt.getTime() > HEARTBEAT_STALE_AFTER_MS;
    return { status: stale ? 'stale' : 'ok', lastRunAt: row.lastRunAt.toISOString() };
  } catch {
    return { status: 'unknown', lastRunAt: null };
  }
}
