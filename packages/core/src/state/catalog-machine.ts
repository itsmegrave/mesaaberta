// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { createMachine } from 'xstate';
import type { CatalogStatus } from '@mesaaberta/db/catalog-status';

/** What an admin does to a catalog entry. */
export type CatalogEvent = 'APPROVE' | 'REJECT' | 'MERGE' | 'DISABLE';

/**
 * A catalog entry (`systems`, `platforms`, `tags`, `place_features`). A suggestion is `pending`
 * until an admin approves or rejects it; any entry not already rejected can be merged into
 * another, which leaves it `rejected` pointing at the target; an approved entry can be disabled,
 * and a disabled one can still be merged away.
 */
export const catalogMachine = createMachine({
  types: {} as { events: { type: CatalogEvent } },
  id: 'catalog',
  initial: 'pending',
  states: {
    pending: { on: { APPROVE: 'approved', REJECT: 'rejected', MERGE: 'rejected' } },
    approved: { on: { DISABLE: 'disabled', MERGE: 'rejected' } },
    rejected: {},
    disabled: { on: { MERGE: 'rejected' } },
  } satisfies Record<CatalogStatus, object>,
});
