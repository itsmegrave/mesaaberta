// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { createMachine } from 'xstate';
import type { LogoStatus, PartnerLinkStatus, PlaceClaimStatus } from '@mesaaberta/db/review-status';

/**
 * A system's logo. The search leaves what it found `pending` (or `missing` when it found nothing);
 * an admin approves or rejects it, and can still reject an approved one. An admin's own upload
 * replaces the row whatever it was, and forgetting deletes it, so neither is a move here.
 */
export const logoMachine = createMachine({
  types: {} as { events: { type: 'APPROVE' | 'REJECT' } },
  id: 'logo',
  initial: 'pending',
  states: {
    pending: { on: { APPROVE: 'approved', REJECT: 'rejected' } },
    approved: { on: { REJECT: 'rejected' } },
    rejected: {},
    missing: {},
  } satisfies Record<LogoStatus, object>,
});

/**
 * Someone's claim to run a place. An admin approves it (the place gets its owner, and the other
 * pending claims on it are rejected) or rejects it.
 */
export const placeClaimMachine = createMachine({
  types: {} as { events: { type: 'APPROVE' | 'REJECT' } },
  id: 'placeClaim',
  initial: 'pending',
  states: {
    pending: { on: { APPROVE: 'approved', REJECT: 'rejected' } },
    approved: {},
    rejected: {},
  } satisfies Record<PlaceClaimStatus, object>,
});

/**
 * A request to show a partner on a place. An admin approves or rejects it; the place's owner or
 * the partner's cancels it while it waits (a new request cancels the old one too); an approved
 * link is removed when either side unlinks it or another link is approved for the place.
 */
export const partnerLinkMachine = createMachine({
  types: {} as { events: { type: 'APPROVE' | 'REJECT' | 'CANCEL' | 'REMOVE' } },
  id: 'partnerLink',
  initial: 'pending',
  states: {
    pending: { on: { APPROVE: 'approved', REJECT: 'rejected', CANCEL: 'cancelled' } },
    approved: { on: { REMOVE: 'removed' } },
    rejected: {},
    cancelled: {},
    removed: {},
  } satisfies Record<PartnerLinkStatus, object>,
});
