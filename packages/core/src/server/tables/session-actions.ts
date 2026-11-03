// Relative imports only: the api Worker bundles this file next to the delivery graph.
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { NewEvent } from '@mesaaberta/events';
import type { AnyDb } from '../db/client';
import { gameTables, playerInvitations, tableSessions } from '../db/schema';
import { authorize, type Actor } from '../auth/policy';
import { Invalid, NotFound } from '../errors';
import { recordEvent } from '../events/outbox';
import { diffFields } from '../events/changes';
import { cancelPendingInvitations } from '../invitations/service';
import { TABLE_LIMITS } from '../../tables/schema';
import { localToInstant } from './schedule';
import { assertTableSchedule, lockTableFamily, lockTableSchedule } from './schedule-guard';
import { listSessions, syncTableSessions } from './sessions';

// Quem mestra's changes to one session of a campaign or adventure (Gerenciar mesa → Sessões):
// schedule one more, move one, write it a note, cancel it. The table's `startsAt` stays its first
// scheduled session: a change that touches that one moves the table too, checked against the GM's
// other tables, and players hear about it as about any change of date (`TableUpdated`). A change to
// a later session records its own event.

/** The longest note quem mestra can leave on a session (the column's check). */
export const SESSION_NOTE_MAX = TABLE_LIMITS.sessionNote;

type Table = typeof gameTables.$inferSelect;
type Family = Awaited<ReturnType<typeof lockTableFamily>>;

/**
 * Runs `write` in a transaction that holds the GM's schedule lock and the table's family, taken
 * first as every write to a table's dates does, so it can move the table's own date safely. The
 * table is checked again once locked.
 */
function inSchedule<T>(
  db: AnyDb,
  actor: Actor | null,
  table: Table,
  write: (tx: AnyDb, family: Family) => Promise<T>,
): Promise<T> {
  return db.transaction(async (transaction) => {
    const tx = transaction as unknown as AnyDb;
    await lockTableSchedule(tx, table.gmId);
    const family = await lockTableFamily(tx, table.id);
    authorize(actor, 'table:sessions', {
      gmId: family.table.gmId,
      tableStatus: family.table.status,
      kind: family.table.kind,
    });
    return write(tx, family);
  });
}

async function sessionTable(db: AnyDb, actor: Actor | null, slug: string): Promise<Table> {
  const [table] = await db.select().from(gameTables).where(eq(gameTables.slug, slug));
  if (!table) throw new NotFound(`no table with slug "${slug}"`);
  authorize(actor, 'table:sessions', {
    gmId: table.gmId,
    tableStatus: table.status,
    kind: table.kind,
  });
  return table;
}

/** The table's scheduled session `sessionId`, locked, or `NotFound`. */
async function scheduledSession(tx: AnyDb, tableId: string, sessionId: string) {
  const [session] = await tx
    .select()
    .from(tableSessions)
    .where(
      and(
        eq(tableSessions.id, sessionId),
        eq(tableSessions.tableId, tableId),
        eq(tableSessions.status, 'scheduled'),
      ),
    )
    .for('update');
  if (!session) throw new NotFound('session');
  return session;
}

/** The earliest scheduled session of the table, the one its `startsAt` mirrors. */
async function firstScheduled(tx: AnyDb, tableId: string) {
  const [first] = await tx
    .select({ startsAt: tableSessions.startsAt, durationMinutes: tableSessions.durationMinutes })
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, 'scheduled')))
    .orderBy(asc(tableSessions.startsAt))
    .limit(1);
  return first ?? null;
}

const noteOf = (note: string | undefined) => {
  const text = note?.trim() ?? '';
  if (text.length > SESSION_NOTE_MAX) throw new Invalid('note', 'too_long');
  return text === '' ? null : text;
};

/** A date in the table's zone that is still ahead, or `Invalid` on `startsAtLocal`. */
function aheadAt(local: string, table: Table, now: Date): Date {
  const startsAt = localToInstant(local, table.timezone);
  if (startsAt <= now) throw new Invalid('startsAtLocal', 'in_the_past');
  return startsAt;
}

/**
 * After a write to the sessions: when the first scheduled one is no longer the table's date, the
 * table follows it (checked against the GM's other tables, invite sequence raised, pending player
 * invitations cancelled as for any change of date) and the change is recorded as a `TableUpdated`
 * of `startsAt`. Answers that event's id, or null when the table's date did not change.
 */
async function followFirst(
  tx: AnyDb,
  { table: current, linked }: Family,
  actor: Actor,
): Promise<string | null> {
  const table = current;
  // An awaiting table's date is the session that passed: it moves only with the GM's answer.
  if (table.status !== 'active') return null;
  const first = await firstScheduled(tx, table.id);
  if (!first || first.startsAt.getTime() === table.startsAt.getTime()) return null;

  assertTableSchedule(linked, { ...current, ...first }, current.id);
  await tx
    .update(gameTables)
    .set({
      startsAt: first.startsAt,
      durationMinutes: first.durationMinutes,
      icalSequence: current.icalSequence + 1,
    })
    .where(eq(gameTables.id, table.id));
  await cancelPendingInvitations(tx, eq(playerInvitations.tableId, table.id), 'table_changed');
  return recordEvent(tx, {
    type: 'TableUpdated',
    actorId: actor.id,
    payload: {
      tableId: table.id,
      slug: table.slug,
      title: table.title,
      changes: diffFields({ startsAt: table.startsAt }, { startsAt: first.startsAt }),
    },
  });
}

const sessionEvent = (
  type: 'SessionScheduled' | 'SessionMoved' | 'SessionCancelled',
  table: Table,
  actor: Actor,
  session: { id: string; startsAt: Date },
  from?: Date,
) =>
  ({
    type,
    actorId: actor.id,
    payload: {
      tableId: table.id,
      slug: table.slug,
      title: table.title,
      sessionId: session.id,
      startsAt: session.startsAt.toISOString(),
      ...(from ? { from: from.toISOString() } : {}),
    },
  }) as NewEvent;

/**
 * Quem mestra adds a session: `startsAtLocal` in the table's zone, still ahead, and not on a date
 * the table already has. Its length defaults to the table's. An adventure stops at its planned
 * sessions until its GM raises them.
 */
export async function scheduleSession(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  input: { startsAtLocal: string; durationMinutes?: number; note?: string },
  now = new Date(),
): Promise<{ eventId: string }> {
  const table = await sessionTable(db, actor, slug);
  const startsAt = aheadAt(input.startsAtLocal, table, now);
  const note = noteOf(input.note);

  const eventId = await inSchedule(db, actor, table, async (tx, family) => {
    const [clash] = await tx
      .select({ id: tableSessions.id })
      .from(tableSessions)
      .where(
        and(
          eq(tableSessions.tableId, table.id),
          eq(tableSessions.status, 'scheduled'),
          eq(tableSessions.startsAt, startsAt),
        ),
      );
    if (clash) throw new Invalid('startsAtLocal', 'session_taken');
    if (table.kind === 'adventure' && table.plannedSessions) {
      const sessions = await listSessions(tx, table, { role: 'gm' });
      const counted = sessions.filter((session) => session.status !== 'cancelled');
      const last = counted.at(-1)?.number ?? 0;
      if (last >= table.plannedSessions) throw new Invalid('startsAtLocal', 'planned_reached');
    }
    const [session] = await tx
      .insert(tableSessions)
      .values({
        tableId: table.id,
        startsAt,
        durationMinutes: input.durationMinutes ?? table.durationMinutes,
        note,
        pinned: true,
      })
      .returning({ id: tableSessions.id, startsAt: tableSessions.startsAt });
    const moved = await followFirst(tx, family, actor!);
    await syncTableSessions(tx, [table.id]);
    return moved ?? recordEvent(tx, sessionEvent('SessionScheduled', table, actor!, session));
  });
  return { eventId };
}

/** Quem mestra moves a scheduled session to `startsAtLocal` (the table's zone), still ahead. */
export async function moveSession(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  input: { sessionId: string; startsAtLocal: string },
  now = new Date(),
): Promise<{ eventId: string }> {
  const table = await sessionTable(db, actor, slug);
  const startsAt = aheadAt(input.startsAtLocal, table, now);

  const eventId = await inSchedule(db, actor, table, async (tx, family) => {
    const session = await scheduledSession(tx, table.id, input.sessionId);
    // The session that passed waits for the GM's answer ("Adiar" moves it).
    if (session.startsAt <= now) throw new Invalid('sessionId', 'already_started');
    const [clash] = await tx
      .select({ id: tableSessions.id })
      .from(tableSessions)
      .where(
        and(
          eq(tableSessions.tableId, table.id),
          eq(tableSessions.status, 'scheduled'),
          eq(tableSessions.startsAt, startsAt),
          ne(tableSessions.id, session.id),
        ),
      );
    if (clash) throw new Invalid('startsAtLocal', 'session_taken');
    await tx
      .update(tableSessions)
      .set({
        startsAt,
        pinned: true,
        movedFrom: sql`coalesce(${tableSessions.movedFrom}, ${session.startsAt.toISOString()}::timestamptz)`,
      })
      .where(eq(tableSessions.id, session.id));
    const moved = await followFirst(tx, family, actor!);
    await syncTableSessions(tx, [table.id]);
    return (
      moved ??
      recordEvent(
        tx,
        sessionEvent('SessionMoved', table, actor!, { ...session, startsAt }, session.startsAt),
      )
    );
  });
  return { eventId };
}

/**
 * Quem mestra writes (or clears) the note players read on a scheduled session. Nobody is told:
 * it shows on the table page. Answers no event.
 */
export async function noteSession(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  input: { sessionId: string; note?: string },
): Promise<{ eventId: null }> {
  const table = await sessionTable(db, actor, slug);
  const note = noteOf(input.note);
  await inSchedule(db, actor, table, async (tx) => {
    await scheduledSession(tx, table.id, input.sessionId);
    await tx.update(tableSessions).set({ note }).where(eq(tableSessions.id, input.sessionId));
  });
  return { eventId: null };
}

/**
 * Quem mestra cancels one scheduled session, with an optional message to the players (kept as the
 * session's note). The table keeps the others; its only scheduled session cannot go (end the table
 * or move it instead), nor the one that passed and waits for the GM's answer.
 */
export async function cancelSession(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  input: { sessionId: string; message?: string },
  now = new Date(),
): Promise<{ eventId: string }> {
  const table = await sessionTable(db, actor, slug);
  const message = noteOf(input.message);

  const eventId = await inSchedule(db, actor, table, async (tx, family) => {
    const session = await scheduledSession(tx, table.id, input.sessionId);
    if (session.startsAt <= now) throw new Invalid('sessionId', 'already_started');
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(tableSessions)
      .where(
        and(
          eq(tableSessions.tableId, table.id),
          eq(tableSessions.status, 'scheduled'),
          sql`${tableSessions.startsAt} > ${now.toISOString()}::timestamptz`,
        ),
      );
    if (count <= 1) throw new Invalid('sessionId', 'only_session');
    await tx
      .update(tableSessions)
      .set({ status: 'cancelled', pinned: true, ...(message ? { note: message } : {}) })
      .where(eq(tableSessions.id, session.id));
    const moved = await followFirst(tx, family, actor!);
    // A weekly table gets its dates topped up again, past the cancelled one.
    await syncTableSessions(tx, [table.id]);
    return moved ?? recordEvent(tx, sessionEvent('SessionCancelled', table, actor!, session));
  });
  return { eventId };
}
