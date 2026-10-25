// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, playerInvitations, ratings, registrations } from '../db/schema';
import { authorize, type Actor } from '../auth/policy';
import { Forbidden, Invalid, NotFound } from '../errors';
import { recordEvent } from '../events/outbox';
import type { NewEvent } from '@mesaaberta/events';
import { diffFields } from '../events/changes';
import type { Changes } from '../events/types';
import { nextStatus, type LifecycleEvent } from '../../tables/lifecycle-machine';
import { cancelPendingInvitations } from '../invitations/service';
import { localToInstant, nextWeeklySession, weeklyInterval } from './schedule';
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
  event: 'TableConcluded' | 'TableSessionHeld' | 'TableNotHeld' | 'TableUpdated',
  changes?: Changes,
  presentPlayerIds?: string[],
): Promise<{ eventId: string }> {
  const table = await findAwaiting(db, actor, slug);

  const eventId = await db.transaction(async (tx) => {
    let values = change(table);
    if (move === 'POSTPONE' || move === 'SESSION_HELD') {
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
      ? await markAttendance(tx as unknown as AnyDb, table.id, presentPlayerIds, {
          keepPresent: table.kind !== 'one_shot',
        })
      : undefined;

    await cancelPendingInvitations(
      tx as unknown as AnyDb,
      eq(playerInvitations.tableId, table.id),
      'table_changed',
    );
    return recordEvent(
      tx as unknown as AnyDb,
      {
        type: event,
        actorId: actor!.id,
        payload: {
          tableId: table.id,
          slug: table.slug,
          title: table.title,
          ...(changes ? { changes } : {}),
          ...(move === 'SESSION_HELD' ? { nextStartsAt: values.startsAt!.toISOString() } : {}),
          ...(absentPlayerIds ? { absentPlayerIds } : {}),
        },
      } as NewEvent,
    );
  });

  return { eventId };
}

/**
 * Records who showed up: the confirmed players in `presentPlayerIds` attended and every other
 * confirmed player did not. Ids that hold no confirmed seat are ignored. Answers the absent ids.
 * A player who already rated the table played it, so they stay present whatever the list says.
 * `keepPresent`: a session of a table that goes on never takes back what an earlier one recorded,
 * so someone who showed up once stays present.
 */
async function markAttendance(
  tx: AnyDb,
  tableId: string,
  presentPlayerIds: string[],
  { keepPresent = false }: { keepPresent?: boolean } = {},
): Promise<string[]> {
  const seated = await tx
    .select({ id: registrations.playerId, attended: registrations.attended })
    .from(registrations)
    .where(and(eq(registrations.tableId, tableId), eq(registrations.status, 'confirmed')));
  const rated = await tx
    .select({ id: ratings.playerId })
    .from(ratings)
    .where(eq(ratings.tableId, tableId));
  const present = new Set([...presentPlayerIds, ...rated.map(({ id }) => id)]);
  const here = seated.filter(({ id }) => present.has(id)).map(({ id }) => id);
  const absent = seated
    .filter(({ id, attended }) => !present.has(id) && !(keepPresent && attended === true))
    .map(({ id }) => id);
  const inTable = and(eq(registrations.tableId, tableId), eq(registrations.status, 'confirmed'));
  if (here.length > 0) {
    await tx
      .update(registrations)
      .set({ attended: true })
      .where(and(inTable, inArray(registrations.playerId, here)));
  }
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

/**
 * The GM says a session of a campaign or adventure happened and more follow. The table stays open
 * for the next one: `nextStartsAtLocal` (in the table's zone) is required for an adventure, and a
 * campaign without it takes its next weekly date. Attendance only adds: whoever showed up once
 * stays present. Nobody is asked to rate; the GM lets players do it (`allowRatings`).
 */
export async function holdSession(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  {
    presentPlayerIds,
    nextStartsAtLocal,
  }: { presentPlayerIds?: string[]; nextStartsAtLocal?: string },
  now = new Date(),
): Promise<{ eventId: string }> {
  const table = await findAwaiting(db, actor, slug);
  if (table.kind === 'one_shot') throw new Invalid('slug', 'not_multi_session');
  let startsAt: Date;
  if (nextStartsAtLocal) startsAt = localToInstant(nextStartsAtLocal, table.timezone);
  else {
    const interval = weeklyInterval(table.recurrence);
    if (!interval) throw new Invalid('nextStartsAtLocal', 'required');
    startsAt = nextWeeklySession(table.startsAt, interval, table.timezone, now);
  }
  if (startsAt <= now) throw new Invalid('nextStartsAtLocal', 'in_the_past');

  return answer(
    db,
    actor,
    slug,
    'SESSION_HELD',
    (current) => ({ startsAt, icalSequence: current.icalSequence + 1 }),
    'TableSessionHeld',
    undefined,
    presentPlayerIds,
  );
}

/**
 * The GM ends a campaign or adventure that went on, without another session: the table is
 * concluded and the players who have not rated yet are asked to. Whoever the GM marked absent is
 * not asked.
 */
export async function finishTable(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
): Promise<{ eventId: string }> {
  const [found] = await db.select().from(gameTables).where(eq(gameTables.slug, slug));
  if (!found) throw new NotFound(`no table with slug "${slug}"`);
  authorize(actor, 'table:finish', {
    gmId: found.gmId,
    tableStatus: found.status,
    kind: found.kind,
  });

  const eventId = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(gameTables)
      .set({ status: 'concluded' })
      .where(
        and(
          eq(gameTables.id, found.id),
          inArray(gameTables.status, ['active', 'awaiting_confirmation']),
        ),
      )
      .returning({ id: gameTables.id });
    if (!updated) throw new Forbidden('table:finish');
    const absent = await tx
      .select({ id: registrations.playerId })
      .from(registrations)
      .where(
        and(
          eq(registrations.tableId, found.id),
          eq(registrations.status, 'confirmed'),
          eq(registrations.attended, false),
        ),
      );
    await cancelPendingInvitations(
      tx as unknown as AnyDb,
      eq(playerInvitations.tableId, found.id),
      'table_changed',
    );
    return recordEvent(tx as unknown as AnyDb, {
      type: 'TableConcluded',
      actorId: actor!.id,
      payload: {
        tableId: found.id,
        slug: found.slug,
        title: found.title,
        ...(absent.length > 0 ? { absentPlayerIds: absent.map(({ id }) => id) } : {}),
      },
    });
  });
  return { eventId };
}

/**
 * The GM lets players rate a campaign or adventure that is still going. Only confirmed players not
 * marked absent, once each: a player already let is left as is. Throws `Invalid` when nobody new
 * could be let.
 */
export async function allowRatings(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  playerIds: string[],
  now = new Date(),
): Promise<{ eventId: string }> {
  const [found] = await db.select().from(gameTables).where(eq(gameTables.slug, slug));
  if (!found) throw new NotFound(`no table with slug "${slug}"`);
  authorize(actor, 'table:finish', {
    gmId: found.gmId,
    tableStatus: found.status,
    kind: found.kind,
  });

  const eventId = await db.transaction(async (tx) => {
    const opened = playerIds.length
      ? await tx
          .update(registrations)
          .set({ ratingOpenedAt: now })
          .where(
            and(
              eq(registrations.tableId, found.id),
              eq(registrations.status, 'confirmed'),
              inArray(registrations.playerId, playerIds),
              isNull(registrations.ratingOpenedAt),
              or(isNull(registrations.attended), ne(registrations.attended, false)),
            ),
          )
          .returning({ id: registrations.playerId })
      : [];
    if (opened.length === 0) throw new Invalid('playerIds', 'nobody_to_let');
    return recordEvent(tx as unknown as AnyDb, {
      type: 'RatingsOpened',
      actorId: actor!.id,
      payload: {
        tableId: found.id,
        slug: found.slug,
        title: found.title,
        playerIds: opened.map(({ id }) => id),
      },
    });
  });
  return { eventId };
}

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
