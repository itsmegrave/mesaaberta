import type { ImportEnv } from '@mesaaberta/core/server/crowdfunding/import/runner';
import { runScheduled } from '@mesaaberta/core/server/events/scheduled';
import type { InstagramEnv } from '@mesaaberta/core/server/instagram/api';
import { logger } from '@mesaaberta/core/server/logger';
import { createQueueConsumer, type QueueBatch } from '@mesaaberta/events';

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
  /**
   * The Queues consumer, shadow stage of ADR 0003: every message is acknowledged and counted, and no
   * handler runs, so nothing user-visible depends on it. The sweeper keeps delivering every event.
   * Live delivery replaces this executor with `createEventExecutor`, one event class at a time.
   */
  async queue(batch: QueueBatch) {
    const log = logger.child({ requestId: crypto.randomUUID(), environment: 'production' });
    const consume = createQueueConsumer({
      executor: async () => ({ status: 'done' }),
      onFailed: (_ref, reason) => log.warn('queue message rejected', { reason }),
    });
    const { done, failed } = await consume(batch);
    log.info('queue shadow', { received: batch.messages.length, acknowledged: done, failed });
  },
  /** There is no public surface; a probe or a stray request gets an empty 404. */
  fetch: () => new Response(null, { status: 404 }),
});

export default createWorker();
