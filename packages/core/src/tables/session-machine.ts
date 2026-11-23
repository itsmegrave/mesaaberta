// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { createMachine } from 'xstate';
import type { TableSessionStatus } from './status-values';

/** What ends a scheduled session. */
export type SessionEvent = 'HELD' | 'NOT_HELD' | 'CANCEL';

/**
 * One date of a table (`table_sessions`). It waits as `scheduled` until the GM says it happened
 * or not, or until it is called off (by the GM, or because the table stopped going). Every end is
 * final; moving a session to another date keeps it `scheduled`.
 */
export const tableSessionMachine = createMachine({
  types: {} as { events: { type: SessionEvent } },
  id: 'tableSession',
  initial: 'scheduled',
  states: {
    scheduled: { on: { HELD: 'held', NOT_HELD: 'not_held', CANCEL: 'cancelled' } },
    held: {},
    not_held: {},
    cancelled: {},
  } satisfies Record<TableSessionStatus, object>,
});

/** The move that closes a session that passed. */
export const SESSION_OUTCOME = { held: 'HELD', not_held: 'NOT_HELD' } as const;
