// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { and, getTableColumns, inArray, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { AnyStateMachine } from 'xstate';
import type { NewEvent } from '@mesaaberta/events';
import type { AnyDb } from '../db/client';
import { recordEvent } from '../events/outbox';
import { next } from '../../state/machine';

/**
 * Moves rows from one status to another, the only way a status is written (ESLint refuses a bare
 * `.set({ status })` outside this module and the files not migrated yet). It asks the machine which
 * status `event` leads to from `from`, updates only the rows still in `from` (so two moves at once
 * cannot both win), and records the domain event in the same transaction: pass the caller's
 * transaction as `db`. Returns null when no row was in `from` any more, which the caller turns into
 * its own refusal. A move the machine does not have is a bug and throws.
 */
export async function applyTransition<S extends string>(
  db: AnyDb,
  {
    table,
    status,
    where,
    machine,
    from,
    event,
    set = {},
    record,
  }: {
    table: PgTable;
    /** The status column of `table`. */
    status: PgColumn;
    /** Which rows: usually `eq(table.id, id)`. */
    where: SQL | undefined;
    machine: AnyStateMachine;
    /** The status (or statuses) the rows must still be in. All must lead to the same status. */
    from: S | readonly S[];
    event: string;
    /** Other columns to write with the status. */
    set?: Record<string, unknown>;
    /** The domain event to record when at least one row moved. */
    record?: NewEvent | ((to: S) => NewEvent);
  },
): Promise<{ to: S; count: number; eventId: string | null } | null> {
  const froms: readonly S[] = typeof from === 'string' ? [from] : from;
  const targets = new Set(froms.map((state) => next<S>(machine, state, event)));
  if (targets.has(null) || targets.size !== 1)
    throw new Error(`${machine.id}: no single move ${event} from ${froms.join(', ')}`);
  const to = [...targets][0] as S;

  const key = Object.entries(getTableColumns(table)).find(([, column]) => column === status)?.[0];
  if (!key) throw new Error(`${machine.id}: the status column is not on this table`);

  const moved = await db
    .update(table)
    .set({ ...set, [key]: to })
    .where(and(where, inArray(status, [...froms])))
    .returning({ status });
  if (!moved.length) return null;

  const event_ = typeof record === 'function' ? record(to) : record;
  const eventId = event_ ? await recordEvent(db, event_) : null;
  return { to, count: moved.length, eventId };
}
