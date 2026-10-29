import type { ImportEnv } from '@mesaaberta/core/server/crowdfunding/import/runner';
import { connectionStringFrom, createDb } from '@mesaaberta/core/server/db/client';
import { createEventExecutor } from '@mesaaberta/core/server/events/executor';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { CRON_MONITORS, unmonitored, type Monitor } from '@mesaaberta/core/server/events/monitors';
import { runScheduled } from '@mesaaberta/core/server/events/scheduled';
import type { SocialEnv } from '@mesaaberta/core/server/social/port';
import { withRequestId } from '@mesaaberta/contracts';
import { logger } from '@mesaaberta/core/server/logger';
import { sentryReleaseFor } from '@mesaaberta/core/observability/sentry-options';
import { createDeadLetterConsumer, createQueueConsumer, type QueueBatch } from '@mesaaberta/events';

// The background half of the system (Trello #120): the Cron Triggers and, later, the Queues
// consumer. It is the same delivery graph the web Worker runs from `scheduled`, packaged on its own
// so the web Worker can stop carrying it. Since the cutover in README.md this Worker owns the crons.
export type WorkerEnv = ImportEnv &
  SocialEnv & {
    EVENT_POLLER?: string;
    /**
     * Comma-separated handler names the queue consumer runs for real (ADR 0003, stage 3), for
     * example `mixpanel-product-events-v1`. Blank keeps the consumer in the shadow stage.
     */
    QUEUE_LIVE_HANDLERS?: string;
    SENTRY_DSN?: string;
    /** "true" sends cron check-ins to Sentry, which creates the monitors on the first one. */
    SENTRY_CRON_MONITORS?: string;
    CF_VERSION_METADATA?: { id?: string };
  };

type Controller = { cron: string; scheduledTime: number };

/** The dead-letter queue of `domain-events-canary` (see wrangler.jsonc). */
const DEAD_LETTER_QUEUE = 'domain-events-canary-dlq';

const liveHandlers = (env: WorkerEnv | undefined) =>
  (env?.QUEUE_LIVE_HANDLERS ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

export const createWorker = (
  run: typeof runScheduled = runScheduled,
  open: typeof createDb = createDb,
  monitor: Monitor = unmonitored,
) => ({
  /** Never throws: a failed run is logged and the next trigger retries what is still due. */
  async scheduled(controller: Controller, env: WorkerEnv) {
    // A run's id, on its lines and as the `actionId` of the events it records (Trello #278).
    const requestId = crypto.randomUUID();
    const log = logger.child({
      requestId,
      environment: 'production',
      release: sentryReleaseFor('worker', env).release,
    });
    const job = CRON_MONITORS[controller.cron];
    const work = () => withRequestId(requestId, () => run(controller, env, { log }));
    // The monitor sees the failure (an error check-in) before it is logged and swallowed here.
    await (job && env.SENTRY_CRON_MONITORS === 'true' ? monitor(job, work) : work()).catch(
      (error) => log.error('scheduled.job_failed', { error }),
    );
  },
  /**
   * The Queues consumer (ADR 0003). Shadow stage, the default: every message is acknowledged and
   * counted, no handler runs and the database is not opened. With `QUEUE_LIVE_HANDLERS` set it runs
   * those handlers, and only those, for each referenced event; the rest of the event stays with the
   * dispatcher that committed it and with the sweeper, which also covers a message that never comes.
   */
  queue(batch: QueueBatch, env?: WorkerEnv) {
    const requestId = crypto.randomUUID();
    return withRequestId(requestId, () => deliver(batch, env, requestId, open));
  },
  /** There is no public surface; a probe or a stray request gets an empty 404. */
  fetch: () => new Response(null, { status: 404 }),
});

/** One delivery of the queue, as the run `requestId`. */
async function deliver(
  batch: QueueBatch,
  env: WorkerEnv | undefined,
  requestId: string,
  open: typeof createDb,
) {
  const log = logger.child({
    requestId,
    environment: 'production',
    release: sentryReleaseFor('worker', env).release,
  });
  if (batch.queue === DEAD_LETTER_QUEUE) {
    // Only a reference travels, so ids are all there is to log. The outbox row is still due and
    // the sweeper runs it; this makes sure someone sees that the queue gave up.
    const dead = createDeadLetterConsumer({
      onDead: (ref, attempts) =>
        log.error('queue.dead_letter', {
          event: 'queue.dead_letter',
          eventId: ref?.eventId,
          resourceType: 'event',
          resourceId: ref?.eventId,
          eventType: ref?.type,
          attempts,
        }),
    });
    await dead(batch);
    return;
  }
  const only = liveHandlers(env);
  const connectionString = only.length > 0 ? connectionStringFrom(env) : undefined;
  const onFailed = (_ref: unknown, reason: string) =>
    log.warn('queue.message_rejected', { reason });
  if (!connectionString) {
    const consume = createQueueConsumer({ executor: async () => ({ status: 'done' }), onFailed });
    const { done, failed } = await consume(batch);
    log.info('queue.shadow_consumed', {
      received: batch.messages.length,
      acknowledged: done,
      failed,
    });
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
    log.info('queue.live_consumed', { received: batch.messages.length, done, retried, failed });
  } catch (error) {
    // Unsettled messages are redelivered by the queue; the outbox rows are untouched.
    log.error('queue.consumer_failed', { error });
    throw error;
  } finally {
    await close();
  }
}

export default createWorker();
