import type { DomainEvent } from '@mesaaberta/contracts';

/** An event to publish: what happened, and who did it (null for the system). */
export type NewEvent = DomainEvent & { actorId: string | null };

export type PublishOptions = {
  /** For tests and imports: the time the event is recorded and due at. Defaults to now. */
  now?: Date;
};

/**
 * Where a domain event is written. The outbox row is the source of truth and the audit log, so
 * writing it is part of the transaction of the change it describes. Recording returns the event's
 * id once it is durable, so a caller can hand it to a dispatcher after the transaction commits.
 *
 * This is the write side only. Delivery to consumers is a `JobTransport` (see ./transport).
 */
export interface EventOutbox {
  record(event: NewEvent, options?: PublishOptions): Promise<string>;
}
