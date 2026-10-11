import { queueTransport, type JobRef, type QueueBinding } from '@mesaaberta/events';
import type { AnyDb } from '../db/client';
import type { Logger } from '../logger';

/**
 * The shadow stage of the Queues canary (ADR 0003, stage 2): after an event is committed, its
 * reference is published to the queue so the consumer can be watched under real traffic. Nothing
 * runs from the message; the outbox row stays the only thing delivery reads.
 *
 * Whether to publish is registered per connection, like fencing: a request registers a resolver
 * that answers `null` (the binding is absent or the flag is off) or the binding to send to. A
 * connection nobody registered (the Cron Trigger's) never publishes.
 */
const resolvers = new WeakMap<object, () => Promise<QueueBinding | null>>();

export function registerShadowQueue(
  db: AnyDb | object,
  resolve: () => Promise<QueueBinding | null>,
): void {
  resolvers.set(db, resolve);
}

/** Publishes one reference. Never throws and never waits on more than one send: it is a probe. */
export async function publishShadow(
  db: AnyDb,
  ref: JobRef,
  log: Pick<Logger, 'info' | 'warn'>,
): Promise<void> {
  try {
    const queue = await resolvers.get(db)?.();
    if (!queue) return;
    await queueTransport(queue).enqueue(ref);
    log.info('queue shadow published', { event: 'queue.shadow.published', ...ref });
  } catch (error) {
    // A queue that is down must not touch delivery, which does not read it.
    log.warn('queue shadow publish failed', {
      event: 'queue.shadow.failed',
      eventId: ref.eventId,
      error,
    });
  }
}
