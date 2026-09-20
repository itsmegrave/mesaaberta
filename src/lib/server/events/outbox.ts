import type { AnyDb } from '../db/client';
import { events } from '../db/schema';
import type { DomainEvent } from './types';

/**
 * Writes an event. Call it with the transaction of the change it describes, so the two commit or
 * roll back together: there is never a change without its record, or a record without its change.
 * Returns the id, to hand to `dispatchEvent` once the transaction has committed.
 */
export async function recordEvent(
	db: AnyDb,
	event: DomainEvent & { actorId: string | null },
	{ now }: { now?: Date } = {}
): Promise<string> {
	const [row] = await db
		.insert(events)
		.values({
			type: event.type,
			actorId: event.actorId,
			payload: event.payload,
			...(now ? { createdAt: now, nextAttemptAt: now } : {})
		})
		.returning({ id: events.id });

	return row.id;
}
