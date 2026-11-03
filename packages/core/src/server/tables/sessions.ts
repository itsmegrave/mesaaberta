// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, tableSessionAttendance, tableSessions } from '../db/schema';

// The sessions of a table (`table_sessions`). For now they follow the table: its `startsAt` is the
// one scheduled session, and each answer to "did it happen?" closes that session and, when the
// table goes on, schedules the next. Every write that changes a table's date or status calls in
// here inside its own transaction, so the rows never disagree with the table.

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

/**
 * Brings the scheduled sessions of these tables in line with the tables themselves, after a write
 * that changed their date, length or status: a table still going has exactly its `startsAt`
 * scheduled (the earliest scheduled row moves there, or one is added), and a table that ended,
 * was closed or was taken down has nothing scheduled left (those rows are cancelled).
 */
export async function syncTableSessions(tx: AnyDb, tableIds: string[]): Promise<void> {
  if (tableIds.length === 0) return;
  const tables = await tx
    .select({
      id: gameTables.id,
      status: gameTables.status,
      startsAt: gameTables.startsAt,
      durationMinutes: gameTables.durationMinutes,
    })
    .from(gameTables)
    .where(inArray(gameTables.id, tableIds));

  for (const table of tables) {
    const scheduled = await tx
      .select({ id: tableSessions.id })
      .from(tableSessions)
      .where(and(eq(tableSessions.tableId, table.id), eq(tableSessions.status, 'scheduled')))
      .orderBy(asc(tableSessions.startsAt))
      .for('update');

    if (!GOING.has(table.status)) {
      if (scheduled.length > 0) {
        await tx
          .update(tableSessions)
          .set({ status: 'cancelled' })
          .where(
            inArray(
              tableSessions.id,
              scheduled.map(({ id }) => id),
            ),
          );
      }
      continue;
    }

    const [next, ...rest] = scheduled;
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
    // One date per table for now: anything else scheduled is left over from an older write.
    if (rest.length > 0) {
      await tx
        .update(tableSessions)
        .set({ status: 'cancelled' })
        .where(
          inArray(
            tableSessions.id,
            rest.map(({ id }) => id),
          ),
        );
    }
  }
}
