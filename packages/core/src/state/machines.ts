// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import type { AnyStateMachine } from 'xstate';
import { TABLE_STATUSES } from '../tables/status-values';
import { REPORT_STATUSES } from '../moderation/reports';
import { reportMachine } from '../moderation/report-machine';
import { tableLifecycle } from '../tables/lifecycle-machine';

/**
 * Every status machine, with the values its column can hold. A spec checks each machine has one
 * state per value, and `machines.md` beside it is drawn from this list (see machines.spec.ts).
 */
export const STATUS_MACHINES: {
  title: string;
  column: string;
  machine: AnyStateMachine;
  values: readonly string[];
}[] = [
  {
    title: 'Table (mesa)',
    column: 'game_tables.status',
    machine: tableLifecycle,
    values: TABLE_STATUSES,
  },
  {
    title: 'Report (denúncia)',
    column: 'reports.status',
    machine: reportMachine,
    values: REPORT_STATUSES,
  },
];
