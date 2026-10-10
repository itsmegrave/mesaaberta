import type { DomainEvent } from '@mesaaberta/contracts';

/** An event to publish: what happened, and who did it (null for the system). */
export type NewEvent = DomainEvent & { actorId: string | null };

export type PublishOptions = {
  /** For tests and imports: the time the event is recorded and due at. Defaults to now. */
  now?: Date;
};

/**
 * Where domain events go. Publishing returns the event's id once it is durable, so a caller can
 * hand it to a dispatcher after its own transaction commits. Adapters (the Postgres outbox today,
 * Cloudflare Queues later) implement this; callers depend on the port, never on an adapter.
 */
export interface EventBus {
  publish(event: NewEvent, options?: PublishOptions): Promise<string>;
}
