import type { ImportEnv } from '@mesaaberta/core/server/crowdfunding/import/runner';
import { runScheduled } from '@mesaaberta/core/server/events/scheduled';
import type { InstagramEnv } from '@mesaaberta/core/server/instagram/api';
import { logger } from '@mesaaberta/core/server/logger';

// The background half of the system (Trello #120): the Cron Triggers and, later, the Queues
// consumer. It is the same delivery graph the web Worker runs from `scheduled`, packaged on its own
// so the web Worker can stop carrying it. Until the cutover in README.md, this Worker is not
// deployed and the web Worker keeps the crons.
export type WorkerEnv = ImportEnv &
  InstagramEnv & {
    EVENT_POLLER?: string;
    SENTRY_DSN?: string;
    CF_VERSION_METADATA?: { id?: string };
  };

type Controller = { cron: string; scheduledTime: number };

export const createWorker = (run: typeof runScheduled = runScheduled) => ({
  /** Never throws: a failed run is logged and the next trigger retries what is still due. */
  async scheduled(controller: Controller, env: WorkerEnv) {
    const log = logger.child({
      requestId: crypto.randomUUID(),
      environment: 'production',
      release: env.CF_VERSION_METADATA?.id,
    });
    await run(controller, env, { log }).catch((error) =>
      log.error('scheduled job failed', { error }),
    );
  },
  /** There is no public surface; a probe or a stray request gets an empty 404. */
  fetch: () => new Response(null, { status: 404 }),
});

export default createWorker();
