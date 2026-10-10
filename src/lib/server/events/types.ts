// The event contracts live in `@mesaaberta/contracts`; only what needs the database stays here.
// Relative imports only across `src/lib/server/events`: the Cron Trigger's Worker entry bundles
// these files without SvelteKit's `$lib` alias.
import type { EventType, StoredEvent } from '@mesaaberta/contracts';

export type * from '@mesaaberta/contracts';

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
