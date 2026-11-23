// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { createMachine } from 'xstate';
import type { InvitationStatus } from '@mesaaberta/db/invitation-status';

/** What ends an invitation. */
export type InvitationEvent = 'ACCEPT' | 'DECLINE' | 'CANCEL' | 'EXPIRE';

/**
 * An invitation (to play at a table, to co-own a partner, to host a place) waits on the person
 * invited, who accepts or declines it; the inviter or the system (a ban, the table ending, the
 * invitee no longer able to take it) cancels it; the sweeper expires it. Every end is final: a new
 * invitation is a new row.
 */
export const invitationMachine = createMachine({
  types: {} as { events: { type: InvitationEvent } },
  id: 'invitation',
  initial: 'pending',
  states: {
    pending: {
      on: { ACCEPT: 'accepted', DECLINE: 'declined', CANCEL: 'cancelled', EXPIRE: 'expired' },
    },
    accepted: {},
    declined: {},
    expired: {},
    cancelled: {},
  } satisfies Record<InvitationStatus, object>,
});

/** The move that ends a pending invitation in `status`. */
export const INVITATION_ENDING = {
  accepted: 'ACCEPT',
  declined: 'DECLINE',
  cancelled: 'CANCEL',
  expired: 'EXPIRE',
} as const satisfies Record<Exclude<InvitationStatus, 'pending'>, InvitationEvent>;
