// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, playerInvitations, registrations } from '../db/schema';
import { authorize, type Actor } from '../auth/policy';
import { Forbidden, Invalid, NotFound } from '../errors';
import { recordEvent } from '../events/outbox';
import { diffFields } from '../events/changes';
import type { Changes } from '../events/types';
import { nextStatus, type LifecycleEvent } from '../../tables/lifecycle-machine';
import { cancelPendingInvitations } from '../invitations/service';
import { localToInstant } from './schedule';
import {
  lockTableSchedule,
  lockTableFamily,
  assertTableSchedule,
  lockTableRows,
} from './schedule-guard';

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
    const due = await tx
      .select({ id: gameTables.id })
      .from(gameTables)
      .where(and(eq(gameTables.status, 'active'), sessionEndedBy(now)));
    await lockTableRows(
      tx as unknown as AnyDb,
      due.map(({ id }) => id),
    );
    const closed = await tx
      .update(gameTables)
      .set({ status: nextStatus('active', 'SESSION_ENDED')! })
      .where(
        and(
          inArray(
            gameTables.id,
            due.map(({ id }) => id),
          ),
          eq(gameTables.status, 'active'),
          sessionEndedBy(now),
        ),
      )
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
 * With `presentPlayerIds`, the confirmed players not in it are marked absent and the rest present.
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
  presentPlayerIds?: string[],
): Promise<{ eventId: string }> {
  const table = await findAwaiting(db, actor, slug);

  const eventId = await db.transaction(async (tx) => {
    let values = change(table);
    if (move === 'POSTPONE') {
      await lockTableSchedule(tx as unknown as AnyDb, table.gmId);
      const { table: current, linked } = await lockTableFamily(tx as unknown as AnyDb, table.id);
      authorize(actor, 'table:confirm', { gmId: current.gmId, tableStatus: current.status });
      values = change(current);
      assertTableSchedule(linked, { ...current, ...values }, current.id);
    }
    const [updated] = await tx
      .update(gameTables)
      .set({ ...values, status: nextStatus('awaiting_confirmation', move)! })
      .where(and(eq(gameTables.id, table.id), eq(gameTables.status, 'awaiting_confirmation')))
      .returning({ id: gameTables.id });
    if (!updated) throw new Forbidden('table:confirm');
    const absentPlayerIds = presentPlayerIds
      ? await markAttendance(tx as unknown as AnyDb, table.id, presentPlayerIds)
      : undefined;

    await cancelPendingInvitations(
      tx as unknown as AnyDb,
      eq(playerInvitations.tableId, table.id),
      'table_changed',
    );
    return recordEvent(tx as unknown as AnyDb, {
      type: event,
      actorId: actor!.id,
      payload: {
        tableId: table.id,
        slug: table.slug,
        title: table.title,
        ...(changes ? { changes } : {}),
        ...(absentPlayerIds ? { absentPlayerIds } : {}),
      },
    });
  });

  return { eventId };
}

/**
 * Records who showed up: the confirmed players in `presentPlayerIds` attended and every other
 * confirmed player did not. Ids that hold no confirmed seat are ignored. Answers the absent ids.
 */
async function markAttendance(
  tx: AnyDb,
  tableId: string,
  presentPlayerIds: string[],
): Promise<string[]> {
  const seated = await tx
    .select({ id: registrations.playerId })
    .from(registrations)
    .where(and(eq(registrations.tableId, tableId), eq(registrations.status, 'confirmed')));
  const present = new Set(presentPlayerIds);
  const absent = seated.map(({ id }) => id).filter((id) => !present.has(id));
  const inTable = and(eq(registrations.tableId, tableId), eq(registrations.status, 'confirmed'));
  await tx.update(registrations).set({ attended: true }).where(inTable);
  if (absent.length > 0) {
    await tx
      .update(registrations)
      .set({ attended: false })
      .where(and(inTable, inArray(registrations.playerId, absent)));
  }
  return absent;
}

/**
 * The GM says the session happened: the table is concluded, and its players are asked to rate it.
 * With `presentPlayerIds` the GM also says who showed up; the absent ones are not asked and cannot rate.
 */
export const concludeTable = (
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  presentPlayerIds?: string[],
) => answer(db, actor, slug, 'HAPPENED', () => ({}), 'TableConcluded', undefined, presentPlayerIds);

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
