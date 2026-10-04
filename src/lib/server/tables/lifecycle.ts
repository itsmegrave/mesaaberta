// Relative imports only: the Cron Trigger's Worker entry bundles this file without `$lib`.
import { and, eq, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables } from '../db/schema';
import { authorize, type Actor } from '../auth/policy';
import { Forbidden, Invalid, NotFound } from '../errors';
import { recordEvent } from '../events/outbox';
import { diffFields } from '../events/changes';
import type { Changes } from '../events/types';
import { nextStatus, type LifecycleEvent } from '../../tables/lifecycle-machine';
import { localToInstant } from './schedule';

/**
 * Whether a table's session is over at `now`. `now` goes in as an ISO string: a `sql` template
 * skips the column encoder, and the postgres.js driver Drizzle wraps sends a raw `Date` as is,
 * which throws `ERR_INVALID_ARG_TYPE` in the Worker.
 */
export const sessionEndedBy = (now: Date) =>
  sql`${gameTables.startsAt} + make_interval(mins => ${gameTables.durationMinutes}) <= ${now.toISOString()}::timestamptz`;

/**
 * Moves every active table whose session is over (`startsAt` plus its duration) to
 * `awaiting_confirmation`, and records one event per table so its GM is asked whether it happened.
 * A table is only ever one run's: the update takes `active` rows, so a repeat finds nothing to do.
 * A campaign counts by its first date too; its recurrence is not managed here. Returns the ids of
 * the events, to dispatch once the transaction has committed.
 */
export async function closeElapsedTables(db: AnyDb, now: Date): Promise<string[]> {
  return db.transaction(async (tx) => {
    const closed = await tx
      .update(gameTables)
      .set({ status: nextStatus('active', 'SESSION_ENDED')! })
      .where(and(eq(gameTables.status, 'active'), sessionEndedBy(now)))
      .returning({ id: gameTables.id, slug: gameTables.slug, title: gameTables.title });

    const eventIds: string[] = [];
    for (const table of closed) {
      eventIds.push(
        await recordEvent(
          tx as unknown as AnyDb,
          {
            type: 'TableAwaitingConfirmation',
            actorId: null,
            payload: { tableId: table.id, slug: table.slug, title: table.title },
          },
          { now },
        ),
      );
    }
    return eventIds;
  });
}

async function findAwaiting(db: AnyDb, actor: Actor | null, slug: string) {
  const [table] = await db.select().from(gameTables).where(eq(gameTables.slug, slug));
  if (!table) throw new NotFound(`no table with slug "${slug}"`);
  authorize(actor, 'table:confirm', { gmId: table.gmId, tableStatus: table.status });

  return table;
}

/**
 * Runs one answer to "did it happen?". The update takes the table only while it still waits for the
 * answer, so two answers at once (or a double click) cannot both win: the second one is refused.
 */
async function answer(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  move: Exclude<LifecycleEvent, 'SESSION_ENDED'>,
  change: (
    table: Awaited<ReturnType<typeof findAwaiting>>,
  ) => Partial<typeof gameTables.$inferInsert>,
  event: 'TableConcluded' | 'TableNotHeld' | 'TableUpdated',
  changes?: Changes,
): Promise<{ eventId: string }> {
  const table = await findAwaiting(db, actor, slug);

  const eventId = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(gameTables)
      .set({ ...change(table), status: nextStatus('awaiting_confirmation', move)! })
      .where(and(eq(gameTables.id, table.id), eq(gameTables.status, 'awaiting_confirmation')))
      .returning({ id: gameTables.id });
    if (!updated) throw new Forbidden('table:confirm');

    return recordEvent(tx as unknown as AnyDb, {
      type: event,
      actorId: actor!.id,
      payload: {
        tableId: table.id,
        slug: table.slug,
        title: table.title,
        ...(changes ? { changes } : {}),
      },
    });
  });

  return { eventId };
}

/** The GM says the session happened: the table is concluded, and its players are asked to rate it. */
export const concludeTable = (db: AnyDb, actor: Actor | null, slug: string) =>
  answer(db, actor, slug, 'HAPPENED', () => ({}), 'TableConcluded');

/** The GM says the session did not happen. Nobody is notified and nothing can be rated. */
export const markTableNotHeld = (db: AnyDb, actor: Actor | null, slug: string) =>
  answer(db, actor, slug, 'NOT_HELD', () => ({}), 'TableNotHeld');

/**
 * The GM moves the session to a new date, read in the table's own zone, and the table is open
 * again until then. The calendar sequence goes up, so invites replace the old event. Throws
 * `Invalid` for a date that is not in the future.
 */
export async function postponeTable(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  startsAtLocal: string,
  now = new Date(),
): Promise<{ eventId: string }> {
  const table = await findAwaiting(db, actor, slug);
  const startsAt = localToInstant(startsAtLocal, table.timezone);
  if (startsAt <= now) throw new Invalid('startsAtLocal', 'in_the_past');

  return answer(
    db,
    actor,
    slug,
    'POSTPONE',
    (current) => ({ startsAt, icalSequence: current.icalSequence + 1 }),
    'TableUpdated',
    diffFields({ startsAt: table.startsAt }, { startsAt }),
  );
}
