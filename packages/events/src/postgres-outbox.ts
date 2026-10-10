import { events, type AnyDb } from '@mesaaberta/db';
import type { EventBus } from './bus';

/**
 * The outbox adapter: an event is a row in `events`. Create it with the transaction of the change
 * the event describes, so the two commit or roll back together: there is never a change without
 * its record, or a record without its change.
 */
export function postgresEventBus(db: AnyDb): EventBus {
  return {
    async publish(event, { now } = {}) {
      const [row] = await db
        .insert(events)
        .values({
          type: event.type,
          actorId: event.actorId,
          payload: event.payload,
          ...(now ? { createdAt: now, nextAttemptAt: now } : {}),
        })
        .returning({ id: events.id });

      return row.id;
    },
  };
}
