// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { createMachine, getNextSnapshot } from 'xstate';
import type { TableStatus } from './status-values';

/** What can happen to a table once its date has come. */
export type LifecycleEvent =
  'SESSION_ENDED' | 'HAPPENED' | 'SESSION_HELD' | 'NOT_HELD' | 'POSTPONE' | 'FINISH';

/**
 * The statuses a table moves through after its date (see `TableStatus`). This is the one place that
 * says which moves exist: the sweeper, the GM's answers and the policy ask it, so none of them
 * repeats the rules. `disabled` is the GM cancelling before the session, which the GM can do at any
 * time and is not part of this flow; the database update that applies a move still checks the
 * current status, so two answers at once cannot both win.
 */
export const tableLifecycle = createMachine({
  types: {} as { events: { type: LifecycleEvent } },
  id: 'tableLifecycle',
  initial: 'active',
  states: {
    // `FINISH`: the GM of a campaign or adventure that went on ends it without another session.
    active: { on: { SESSION_ENDED: 'awaiting_confirmation', FINISH: 'concluded' } },
    awaiting_confirmation: {
      // `SESSION_HELD`: it happened and more sessions follow, so the table stays open.
      on: {
        HAPPENED: 'concluded',
        SESSION_HELD: 'active',
        NOT_HELD: 'not_held',
        POSTPONE: 'active',
      },
    },
    concluded: {},
    not_held: {},
    disabled: {},
    // Not public yet. Publishing is the GM's own move (see `publishTable`), not part of this flow.
    draft: {},
  },
});

/** The status `event` takes a table in `from` to, or null when that move does not exist. */
export function nextStatus(from: TableStatus, event: LifecycleEvent): TableStatus | null {
  const snapshot = tableLifecycle.resolveState({ value: from, context: undefined });
  if (!snapshot.can({ type: event })) return null;

  return getNextSnapshot(tableLifecycle, snapshot, { type: event }).value as TableStatus;
}
