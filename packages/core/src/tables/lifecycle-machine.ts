// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { createMachine } from 'xstate';
import { next } from '../state/machine';
import type { TableStatus } from './status-values';

/** What can happen to a table once its date has come. */
export type LifecycleEvent =
  | 'SESSION_ENDED'
  | 'HAPPENED'
  | 'SESSION_HELD'
  | 'NOT_HELD'
  | 'POSTPONE'
  | 'FINISH'
  | 'PUBLISH'
  | 'DISABLE';

/**
 * The statuses a table moves through after its date (see `TableStatus`). This is the one place that
 * says which moves exist: the sweeper, the GM's answers and the policy ask it, so none of them
 * repeats the rules. `DISABLE` is the GM (or an admin) taking the table down, which they can do from
 * any state but `concluded`; the database update that applies a move still checks the current
 * status, so two answers at once cannot both win.
 */
export const tableLifecycle = createMachine({
  types: {} as { events: { type: LifecycleEvent } },
  id: 'tableLifecycle',
  initial: 'active',
  states: {
    // `FINISH`: the GM of a campaign or adventure that went on ends it without another session.
    active: {
      on: { SESSION_ENDED: 'awaiting_confirmation', FINISH: 'concluded', DISABLE: 'disabled' },
    },
    awaiting_confirmation: {
      // `SESSION_HELD`: it happened and more sessions follow, so the table stays open.
      on: {
        HAPPENED: 'concluded',
        SESSION_HELD: 'active',
        NOT_HELD: 'not_held',
        POSTPONE: 'active',
        FINISH: 'concluded',
        DISABLE: 'disabled',
      },
    },
    concluded: {},
    not_held: { on: { DISABLE: 'disabled' } },
    disabled: {},
    // Not public yet: the GM publishes it (`publishTable`) or drops it.
    draft: { on: { PUBLISH: 'active', DISABLE: 'disabled' } },
  },
});

/** The status `event` takes a table in `from` to, or null when that move does not exist. */
export function nextStatus(from: TableStatus, event: LifecycleEvent): TableStatus | null {
  return next<TableStatus>(tableLifecycle, from, event);
}
