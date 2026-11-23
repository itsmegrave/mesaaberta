// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { createMachine } from 'xstate';
import type { CrowdfundingStatus, ListingStatus } from '@mesaaberta/db/listing-status';

/** What happens to a listing. */
export type ListingEvent = 'APPROVE' | 'REVIEW_AGAIN' | 'REMOVE';

/**
 * A partner, tool or place a member sends to a directory. An admin approves it; an edit by someone
 * the listing does not vouch for sends it back to review; an admin rejects or takes it down, or its
 * submitter withdraws it, and it is removed for good. A place hidden by reports keeps its status:
 * hiding (`places.hidden_at`) is a quarantine over the listing, lifted by an admin, not a step here.
 */
export const listingMachine = createMachine({
  types: {} as { events: { type: ListingEvent } },
  id: 'listing',
  initial: 'pending',
  states: {
    pending: { on: { APPROVE: 'approved', REVIEW_AGAIN: 'pending', REMOVE: 'removed' } },
    approved: { on: { REVIEW_AGAIN: 'pending', REMOVE: 'removed' } },
    removed: {},
  } satisfies Record<ListingStatus, object>,
});

/** A crowdfunding campaign: listed when sent or imported, until an admin removes it. */
export const crowdfundingMachine = createMachine({
  types: {} as { events: { type: 'REMOVE' } },
  id: 'crowdfunding',
  initial: 'listed',
  states: {
    listed: { on: { REMOVE: 'removed' } },
    removed: {},
  } satisfies Record<CrowdfundingStatus, object>,
});
