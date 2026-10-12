import { queueTransport, type JobRef, type QueueBinding } from '@mesaaberta/events';
import type { AnyDb } from '../db/client';
import type { Logger } from '../logger';

/**
 * One event class delivered live by the queue (ADR 0003, stage 3). The dispatcher that committed
 * the event leaves the named handlers pending and publishes the event's reference once its own
 * handlers are done; the queue consumer runs them. The outbox row stays the truth: a reference
 * that is lost, late or never consumed leaves the row due, and the sweeper runs what is pending.
 *
 * Like fencing, it is registered per connection: a request registers a resolver that answers
 * `null` (no binding, or the class's flag is off) or the queue and the handler names it takes. A
 * connection nobody registered (the Cron Trigger's, the consumer's) hands nothing over.
 */
export type LiveRouting = { queue: QueueBinding; handlers: readonly string[] };

const resolvers = new WeakMap<object, () => Promise<LiveRouting | null>>();

export function registerLiveQueue(
  db: AnyDb | object,
  resolve: () => Promise<LiveRouting | null>,
): void {
  resolvers.set(db, resolve);
}

/** Never throws: a flag service or binding that fails means this dispatcher runs everything itself. */
export async function liveRoutingFor(
  db: AnyDb,
  log: Pick<Logger, 'warn'>,
): Promise<LiveRouting | null> {
  try {
    const routing = await resolvers.get(db)?.();
    return routing && routing.handlers.length > 0 ? routing : null;
  } catch (error) {
    log.warn('queue live routing failed', { event: 'queue.live.routing_failed', error });
    return null;
  }
}

/** Publishes the reference for the handlers left pending. Never throws: the sweeper is the net. */
export async function publishLive(
  routing: LiveRouting,
  ref: JobRef,
  log: Pick<Logger, 'info' | 'warn'>,
): Promise<void> {
  try {
    await queueTransport(routing.queue).enqueue(ref);
    log.info('queue live published', { event: 'queue.live.published', ...ref });
  } catch (error) {
    log.warn('queue live publish failed', {
      event: 'queue.live.failed',
      eventId: ref.eventId,
      error,
    });
  }
}
