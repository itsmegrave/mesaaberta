import type { AnyDb } from '../db/client';
import { events } from '../db/schema';
import type { Logger } from '../logger';
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

/**
 * Records the connection log a sign-in requires (Marco Civil da Internet, art. 15), without
 * failing the sign-in itself if the write does not go through.
 */
export async function recordConnection(
	db: AnyDb,
	{ actorId, ip, log }: { actorId: string; ip: string | null; log: Pick<Logger, 'warn'> }
): Promise<void> {
	try {
		await recordEvent(db, { type: 'UserSignedIn', actorId, payload: { ip } });
	} catch (error) {
		log.warn('connection log: could not record the sign-in', { error });
	}
}
