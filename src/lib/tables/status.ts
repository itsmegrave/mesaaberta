import { m } from '$lib/paraglide/messages';

/**
 * Where a table stands. `active` is open; `disabled` is the GM cancelling it before the session.
 * Once the session is over it waits for the GM (`awaiting_confirmation`), who says it happened
 * (`concluded`) or that it did not (`not_held`), or moves it to a new date (back to `active`).
 */
export { TABLE_STATUSES, type TableStatus } from './status-values';
import type { TableStatus } from './status-values';

/** The tag a table carries once it is not open, or null while it is `active`. */
export function tableStatusLabel(status: TableStatus): string | null {
  switch (status) {
    case 'active':
      return null;
    case 'disabled':
      return m.dash_disabled();
    case 'awaiting_confirmation':
      return m.table_status_awaiting_confirmation();
    case 'concluded':
      return m.table_status_concluded();
    case 'not_held':
      return m.table_status_not_held();
  }
}
