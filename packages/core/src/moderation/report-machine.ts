// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { createMachine } from 'xstate';
import type { ReportStatus } from './reports';

/** What an admin (or a removal that settles the report) does with a report. */
export type ReportEvent = 'REVIEW' | 'RESOLVE' | 'DISMISS';

/**
 * A report waits on an admin while `open` or `reviewing`, then is closed for good: accepted
 * (`resolved`) or not (`dismissed`). A closed report is never reopened; a new one is filed instead.
 */
export const reportMachine = createMachine({
  types: {} as { events: { type: ReportEvent } },
  id: 'report',
  initial: 'open',
  states: {
    open: { on: { REVIEW: 'reviewing', RESOLVE: 'resolved', DISMISS: 'dismissed' } },
    reviewing: { on: { RESOLVE: 'resolved', DISMISS: 'dismissed' } },
    resolved: {},
    dismissed: {},
  } satisfies Record<ReportStatus, object>,
});
