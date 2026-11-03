// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { events, gameTables, tableSessionAttendance, tableSessions } from '../db/schema';
import { nextWeeklySession, weeklyInterval } from './schedule';

// The sessions of a table (`table_sessions`). The table's `startsAt` is always its first scheduled
// session (lists, reminders and the sweeper keep reading it); a campaign or adventure may have more
// dates after it, from its weekly rule or scheduled by its GM. Each answer to "did it happen?"
// closes that session and, when the table goes on, the next one takes over. Every write that changes
// a table's date or status calls in here inside its own transaction, so the rows never disagree with
// the table.

/** Statuses of a table that still has a session ahead (or one waiting for its GM's answer). */
const GOING = new Set(['active', 'awaiting_confirmation', 'draft']);

export type Attendance = { present: string[]; absent: string[] };

/**
 * The session that started at `startsAt` is over: it happened (`held`, with who showed up when the
 * GM said) or did not (`not_held`). Takes the scheduled row of that date, or the table's earliest
 * scheduled one; a table with none (made before sessions were tracked, or missed) gets the row now.
 */
export async function closeSession(
  tx: AnyDb,
  table: { id: string; startsAt: Date; durationMinutes: number },
  status: 'held' | 'not_held',
  attendance?: Attendance,
): Promise<string> {
  const scheduled = await tx
    .select({ id: tableSessions.id, startsAt: tableSessions.startsAt })
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, table.id), eq(tableSessions.status, 'scheduled')))
    .orderBy(asc(tableSessions.startsAt))
    .for('update');
  const match =
    scheduled.find((row) => row.startsAt.getTime() === table.startsAt.getTime()) ?? scheduled[0];

  let sessionId: string;
  if (match) {
    await tx
      .update(tableSessions)
      .set({ status, startsAt: table.startsAt })
      .where(eq(tableSessions.id, match.id));
    sessionId = match.id;
  } else {
    const [created] = await tx
      .insert(tableSessions)
      .values({
        tableId: table.id,
        startsAt: table.startsAt,
        durationMinutes: table.durationMinutes,
        status,
      })
      .returning({ id: tableSessions.id });
    sessionId = created.id;
  }

  const rows = [
    ...(attendance?.present ?? []).map((playerId) => ({ sessionId, playerId, attended: true })),
    ...(attendance?.absent ?? []).map((playerId) => ({ sessionId, playerId, attended: false })),
  ];
  if (rows.length > 0) {
    await tx
      .insert(tableSessionAttendance)
      .values(rows)
      .onConflictDoUpdate({
        target: [tableSessionAttendance.sessionId, tableSessionAttendance.playerId],
        set: { attended: sql`excluded.attended` },
      });
  }
  return sessionId;
}

const WEEK = 7 * 24 * 3_600_000;

/** How many dates a weekly table keeps written out ahead, the next one included. */
export const UPCOMING_SESSIONS = 4;

type Row = { id: string; startsAt: Date; pinned: boolean; movedFrom: Date | null };

/** Cancels the pinned rows (the GM made them: they stay in the history) and deletes the rest. */
async function dropSessions(tx: AnyDb, rows: Row[]) {
  const pinned = rows.filter((row) => row.pinned).map(({ id }) => id);
  const loose = rows.filter((row) => !row.pinned).map(({ id }) => id);
  if (pinned.length > 0) {
    await tx
      .update(tableSessions)
      .set({ status: 'cancelled' })
      .where(inArray(tableSessions.id, pinned));
  }
  if (loose.length > 0) await tx.delete(tableSessions).where(inArray(tableSessions.id, loose));
}

/**
 * Brings the scheduled sessions of these tables in line with the tables themselves, after a write
 * that changed their date, length, rule or status. A table still going has its `startsAt` as its
 * first scheduled session (the earliest scheduled row moves there, or one is added); later dates
 * stay as long as they are after it, and a weekly campaign or adventure (not a draft) is topped up
 * from its rule to `UPCOMING_SESSIONS` dates. `reflow` (the rule, time or length changed): the
 * later dates nobody pinned are written again from the rule. A table that ended, was closed or was
 * taken down has nothing scheduled left: the next session is cancelled, as are the ones its GM
 * scheduled, and the dates the rule wrote go.
 */
export async function syncTableSessions(
  tx: AnyDb,
  tableIds: string[],
  { reflow = false }: { reflow?: boolean } = {},
): Promise<void> {
  if (tableIds.length === 0) return;
  const tables = await tx
    .select({
      id: gameTables.id,
      status: gameTables.status,
      kind: gameTables.kind,
      startsAt: gameTables.startsAt,
      durationMinutes: gameTables.durationMinutes,
      recurrence: gameTables.recurrence,
      until: gameTables.until,
      timezone: gameTables.timezone,
    })
    .from(gameTables)
    .where(inArray(gameTables.id, tableIds));

  for (const table of tables) {
    const scheduled: Row[] = await tx
      .select({
        id: tableSessions.id,
        startsAt: tableSessions.startsAt,
        pinned: tableSessions.pinned,
        movedFrom: tableSessions.movedFrom,
      })
      .from(tableSessions)
      .where(and(eq(tableSessions.tableId, table.id), eq(tableSessions.status, 'scheduled')))
      .orderBy(asc(tableSessions.startsAt))
      .for('update');

    const [next, ...rest] = scheduled;
    if (!GOING.has(table.status)) {
      if (next) {
        await tx
          .update(tableSessions)
          .set({ status: 'cancelled' })
          .where(eq(tableSessions.id, next.id));
      }
      await dropSessions(tx, rest);
      continue;
    }

    if (next) {
      await tx
        .update(tableSessions)
        .set({ startsAt: table.startsAt, durationMinutes: table.durationMinutes })
        .where(eq(tableSessions.id, next.id));
    } else {
      await tx.insert(tableSessions).values({
        tableId: table.id,
        startsAt: table.startsAt,
        durationMinutes: table.durationMinutes,
      });
    }
    // Only dates after the next one stay; after a change of rule, only the pinned ones.
    const stale = rest.filter((row) => row.startsAt <= table.startsAt || (reflow && !row.pinned));
    await dropSessions(tx, stale);
    const kept = rest.filter((row) => !stale.includes(row));

    const interval = weeklyInterval(table.recurrence);
    if (!interval || table.kind === 'one_shot' || table.status === 'draft') continue;
    const missing = UPCOMING_SESSIONS - 1 - kept.length;
    if (missing <= 0) continue;
    // The rule's own grid: the latest date it wrote that nobody moved, or the table's date.
    const anchor =
      [...kept].reverse().find((row) => !row.pinned)?.startsAt ??
      (next?.pinned ? next.movedFrom : null) ??
      table.startsAt;
    // A date already there is not written twice; and the week of a session that was moved away or
    // cancelled stays without one, whatever the time the rule now says.
    const rows = await tx
      .select({
        startsAt: tableSessions.startsAt,
        movedFrom: tableSessions.movedFrom,
        status: tableSessions.status,
      })
      .from(tableSessions)
      .where(and(eq(tableSessions.tableId, table.id), gt(tableSessions.startsAt, table.startsAt)));
    const there = new Set(rows.map((row) => row.startsAt.getTime()));
    const gone = [
      ...rows.flatMap((row) => [
        ...(row.status === 'cancelled' ? [row.startsAt] : []),
        ...(row.movedFrom ? [row.movedFrom] : []),
      ]),
      ...(next?.movedFrom ? [next.movedFrom] : []),
    ].map((date) => date.getTime());
    const halfStep = (interval * WEEK) / 2;
    const taken = (date: Date) =>
      there.has(date.getTime()) || gone.some((time) => Math.abs(time - date.getTime()) < halfStep);
    const fresh: Date[] = [];
    let date = anchor;
    for (let step = 0; fresh.length < missing && step < 52; step++) {
      date = nextWeeklySession(date, interval, table.timezone, date);
      if (table.until && date > table.until) break;
      if (date <= table.startsAt || taken(date)) continue;
      fresh.push(date);
    }
    if (fresh.length > 0) {
      await tx.insert(tableSessions).values(
        fresh.map((startsAt) => ({
          tableId: table.id,
          startsAt,
          durationMinutes: table.durationMinutes,
        })),
      );
    }
  }
}

/**
 * The first scheduled session of a table after `after` that is still ahead at `now`: what "A mesa
 * continua?" offers once the session at `after` is over. Null when none is scheduled.
 */
export async function nextScheduledAfter(
  db: AnyDb,
  tableId: string,
  after: Date,
  now: Date,
): Promise<Date | null> {
  const [row] = await db
    .select({ startsAt: tableSessions.startsAt })
    .from(tableSessions)
    .where(
      and(
        eq(tableSessions.tableId, tableId),
        eq(tableSessions.status, 'scheduled'),
        gt(tableSessions.startsAt, after > now ? after : now),
      ),
    )
    .orderBy(asc(tableSessions.startsAt))
    .limit(1);
  return row?.startsAt ?? null;
}

/** Who is looking at a table's sessions, which decides what each row carries. */
export type SessionViewer =
  /** Quem mestra (or an admin): notes, and how many came to each session. */
  | { role: 'gm' }
  /** A confirmed player: notes, and their own attendance. */
  | { role: 'player'; playerId: string }
  /** Anyone else: the dates alone. */
  | { role: 'visitor' };

export type SessionRow = {
  id: string;
  /** "Sessão 5": counted from the table's first session, the ones before tracking included. */
  number: number;
  startsAt: Date;
  durationMinutes: number;
  status: 'scheduled' | 'held' | 'not_held' | 'cancelled';
  note: string | null;
  movedFrom: Date | null;
  /** For quem mestra, a session that happened: how many of the seated players came. */
  present: { count: number; of: number } | null;
  /** For a player, a session that happened: whether they were there (null when nobody said). */
  attended: boolean | null;
};

/**
 * A table's sessions, oldest first, as `viewer` may see them. The sessions held before they were
 * tracked (the `TableSessionHeld` events with no row) count towards the numbers.
 */
export async function listSessions(
  db: AnyDb,
  table: { id: string; status: string },
  viewer: SessionViewer,
): Promise<SessionRow[]> {
  const [rows, [logged]] = await Promise.all([
    db
      .select({
        id: tableSessions.id,
        startsAt: tableSessions.startsAt,
        durationMinutes: tableSessions.durationMinutes,
        status: tableSessions.status,
        note: tableSessions.note,
        movedFrom: tableSessions.movedFrom,
      })
      .from(tableSessions)
      .where(eq(tableSessions.tableId, table.id))
      .orderBy(asc(tableSessions.startsAt), asc(tableSessions.createdAt)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(
        and(eq(events.type, 'TableSessionHeld'), sql`${events.payload}->>'tableId' = ${table.id}`),
      ),
  ]);
  // Each session held and followed by another is one `TableSessionHeld`; a concluded table's last
  // one is not. What the log has beyond the rows was held before sessions were tracked.
  const heldRows = rows.filter((row) => row.status === 'held').length;
  const tracked = table.status === 'concluded' && heldRows > 0 ? heldRows - 1 : heldRows;
  const before = Math.max(0, (logged?.count ?? 0) - tracked);

  const heldIds = rows.filter((row) => row.status === 'held').map(({ id }) => id);
  const attendance =
    viewer.role === 'visitor' || heldIds.length === 0
      ? []
      : await db
          .select({
            sessionId: tableSessionAttendance.sessionId,
            playerId: tableSessionAttendance.playerId,
            attended: tableSessionAttendance.attended,
          })
          .from(tableSessionAttendance)
          .where(inArray(tableSessionAttendance.sessionId, heldIds));

  return rows.map((row, index) => {
    const here = attendance.filter((mark) => mark.sessionId === row.id);
    return {
      ...row,
      number: before + index + 1,
      note: viewer.role === 'visitor' ? null : row.note,
      present:
        viewer.role === 'gm' && row.status === 'held' && here.length > 0
          ? { count: here.filter((mark) => mark.attended).length, of: here.length }
          : null,
      attended:
        viewer.role === 'player'
          ? (here.find((mark) => mark.playerId === viewer.playerId)?.attended ?? null)
          : null,
    };
  });
}
