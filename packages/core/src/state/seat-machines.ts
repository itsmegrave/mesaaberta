// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { createMachine } from 'xstate';
import type { RegistrationStatus, SessionSignupStatus } from '@mesaaberta/db/seat-status';

/**
 * A seat at a table. A request waits on the GM (`pending`) until they approve it; a table that
 * takes players at once inserts the row as `confirmed`. Declining, leaving or being removed
 * deletes the row, so `confirmed` has no move out.
 */
export const registrationMachine = createMachine({
  types: {} as { events: { type: 'APPROVE' } },
  id: 'registration',
  initial: 'pending',
  states: {
    pending: { on: { APPROVE: 'confirmed' } },
    confirmed: {},
  } satisfies Record<RegistrationStatus, object>,
});

/**
 * A place at one session. With room the player is `going`; without it they wait, and move up
 * (`PROMOTE`) when a place frees or the GM adds them. Leaving deletes the row.
 */
export const sessionSignupMachine = createMachine({
  types: {} as { events: { type: 'PROMOTE' } },
  id: 'sessionSignup',
  initial: 'waiting',
  states: {
    waiting: { on: { PROMOTE: 'going' } },
    going: {},
  } satisfies Record<SessionSignupStatus, object>,
});
