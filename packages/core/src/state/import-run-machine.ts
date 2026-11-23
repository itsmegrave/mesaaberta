// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { createMachine } from 'xstate';
import type { ImportRunStatus } from '@mesaaberta/db/import-run-status';

/**
 * A daily crowdfunding import run. The worker holding its lease finishes it as `complete`,
 * `partial` (stopped at a cursor, picked up next time) or `failed`. Taking a run (a new day, or one
 * whose lease ran out) is an upsert that writes `running` whatever the row held, so it is not a
 * move here.
 */
export const importRunMachine = createMachine({
  types: {} as { events: { type: 'COMPLETE' | 'PARTIAL' | 'FAIL' } },
  id: 'importRun',
  initial: 'running',
  states: {
    running: { on: { COMPLETE: 'complete', PARTIAL: 'partial', FAIL: 'failed' } },
    complete: {},
    partial: {},
    failed: {},
  } satisfies Record<ImportRunStatus, object>,
});

/** The move that ends a run in `status`. */
export const IMPORT_RUN_ENDING = {
  complete: 'COMPLETE',
  partial: 'PARTIAL',
  failed: 'FAIL',
} as const;
