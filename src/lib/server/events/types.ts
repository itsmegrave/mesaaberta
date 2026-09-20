// Relative imports only across `src/lib/server/events`: the Cron Trigger's Worker entry bundles
// these files without SvelteKit's `$lib` alias.

/**
 * Domain events, and what each one carries. The payload holds ids and public facts only, never an
 * email address or a token: it is kept forever as the audit log. Later slices add their events here.
 */
export type DomainEvent =
	| { type: 'TableCreated'; payload: { tableId: string; slug: string; title: string } }
	| { type: 'TableUpdated'; payload: { tableId: string; slug: string; title: string } }
	| { type: 'TableDisabled'; payload: { tableId: string; slug: string; title: string } }
	// A player asked for a seat at a table that approves each one. Takes no seat.
	| { type: 'JoinRequested'; payload: Registration }
	| { type: 'JoinApproved'; payload: Registration }
	| { type: 'JoinDeclined'; payload: Registration }
	// A seat was confirmed: an automatic join, or an approval.
	| { type: 'PlayerJoined'; payload: Registration }
	| { type: 'PlayerLeft'; payload: Registration & { reason: 'left' | 'removed' } }
	// A player rated the table and its GM (or changed their rating). Scores and comments are not in the payload.
	| { type: 'RatingSubmitted'; payload: Registration };

type Registration = { tableId: string; slug: string; playerId: string };

export type EventType = DomainEvent['type'];

/** An event as a handler receives it. `id` is the idempotency key: use it to make a handler safe to repeat. */
export type StoredEvent = DomainEvent & {
	id: string;
	actorId: string | null;
	createdAt: Date;
	attempts: number;
};

/**
 * Something that reacts to events (send an invite, forward to analytics). It runs at least once, so
 * it must be idempotent: a repeat for the same `event.id` must do nothing new. A retry runs only the
 * handlers that have not succeeded yet.
 */
export type Handler = {
	/** Stable and unique: it is recorded when the handler succeeds. Never rename one that has run. */
	name: string;
	types: readonly EventType[];
	/** The dispatcher passes its database connection; handlers must not open a second one. */
	handle(event: StoredEvent, db: import('../db/client').AnyDb): Promise<void>;
};
