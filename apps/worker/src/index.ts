import type { ImportEnv } from '@mesaaberta/core/server/crowdfunding/import/runner';
import { connectionStringFrom, createDb } from '@mesaaberta/core/server/db/client';
import { createEventExecutor } from '@mesaaberta/core/server/events/executor';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { runScheduled } from '@mesaaberta/core/server/events/scheduled';
import type { InstagramEnv } from '@mesaaberta/core/server/instagram/api';
import { logger } from '@mesaaberta/core/server/logger';
import { createQueueConsumer, type QueueBatch } from '@mesaaberta/events';

// The background half of the system (Trello #120): the Cron Triggers and, later, the Queues
// consumer. It is the same delivery graph the web Worker runs from `scheduled`, packaged on its own
// so the web Worker can stop carrying it. Since the cutover in README.md this Worker owns the crons.
export type WorkerEnv = ImportEnv &
  InstagramEnv & {
    EVENT_POLLER?: string;
    /**
     * Comma-separated handler names the queue consumer runs for real (ADR 0003, stage 3), for
     * example `mixpanel-product-events-v1`. Blank keeps the consumer in the shadow stage.
     */
    QUEUE_LIVE_HANDLERS?: string;
    SENTRY_DSN?: string;
    CF_VERSION_METADATA?: { id?: string };
  };

type Controller = { cron: string; scheduledTime: number };

const liveHandlers = (env: WorkerEnv | undefined) =>
  (env?.QUEUE_LIVE_HANDLERS ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

export const createWorker = (
  run: typeof runScheduled = runScheduled,
  open: typeof createDb = createDb,
) => ({
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
   * The Queues consumer (ADR 0003). Shadow stage, the default: every message is acknowledged and
   * counted, no handler runs and the database is not opened. With `QUEUE_LIVE_HANDLERS` set it runs
   * those handlers, and only those, for each referenced event; the rest of the event stays with the
   * dispatcher that committed it and with the sweeper, which also covers a message that never comes.
   */
  async queue(batch: QueueBatch, env?: WorkerEnv) {
    const log = logger.child({
      requestId: crypto.randomUUID(),
      environment: 'production',
      release: env?.CF_VERSION_METADATA?.id,
    });
    const only = liveHandlers(env);
    const connectionString = only.length > 0 ? connectionStringFrom(env) : undefined;
    const onFailed = (_ref: unknown, reason: string) =>
      log.warn('queue message rejected', { reason });
    if (!connectionString) {
      const consume = createQueueConsumer({ executor: async () => ({ status: 'done' }), onFailed });
      const { done, failed } = await consume(batch);
      log.info('queue shadow', { received: batch.messages.length, acknowledged: done, failed });
      return;
    }
    const { db, close } = open(connectionString);
    try {
      const consume = createQueueConsumer({
        // Fenced: a delivery that outlives its lease must not finish someone else's claim.
        executor: createEventExecutor(db, handlersFor(env), {
          log,
          options: { only, fenced: true },
        }),
        onFailed,
      });
      const { done, retried, failed } = await consume(batch);
      log.info('queue live', { received: batch.messages.length, done, retried, failed });
    } catch (error) {
      // Unsettled messages are redelivered by the queue; the outbox rows are untouched.
      log.error('queue consumer failed', { error });
      throw error;
    } finally {
      await close();
    }
  },
  /** There is no public surface; a probe or a stray request gets an empty 404. */
  fetch: () => new Response(null, { status: 404 }),
});

export default createWorker();
