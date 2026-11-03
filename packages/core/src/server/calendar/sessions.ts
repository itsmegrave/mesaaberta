// Relative imports only: the invite handler bundles this file into the event-delivery graph.
import { and, eq, gte, inArray, or } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, tableSessionSignups, tableSessions } from '../db/schema';
import type { CalendarSession, CalendarTable } from './ics';

/** A table's session in the calendar, with who plays it when the table signs up per session. */
type SessionWithPlayers = CalendarSession & { going?: string[] };

/**
 * A table with its sessions; `signups` when it is a campanha aberta whose players sign up per
 * session (`use_session_signup`: rows only exist while it is on), so each player's calendar has only
 * the sessions they play (`calendarFor`).
 */
export type CalendarTableWithSessions = Omit<CalendarTable, 'sessions'> & {
  sessions: SessionWithPlayers[];
  signups: boolean;
};

/**
 * The tables with their sessions from the next one on (`CalendarTable.sessions`), so the calendar
 * shows a cancelled, moved or added session as the table page does. Cancelled dates before the
 * table's next session no longer matter and are left out.
 */
export async function withSessions<T extends CalendarTable>(
  db: AnyDb,
  tables: T[],
): Promise<(Omit<T, 'sessions' | 'signups'> & CalendarTableWithSessions)[]> {
  if (tables.length === 0) return [];
  const ids = tables.map((table) => table.id);
  const [rows, going] = await Promise.all([
    db
      .select({
        id: tableSessions.id,
        tableId: tableSessions.tableId,
        startsAt: tableSessions.startsAt,
        durationMinutes: tableSessions.durationMinutes,
        status: tableSessions.status,
        movedFrom: tableSessions.movedFrom,
      })
      .from(tableSessions)
      .innerJoin(gameTables, eq(gameTables.id, tableSessions.tableId))
      .where(
        and(
          inArray(tableSessions.tableId, ids),
          or(
            eq(tableSessions.status, 'scheduled'),
            and(
              eq(tableSessions.status, 'cancelled'),
              gte(tableSessions.startsAt, gameTables.startsAt),
            ),
          ),
        ),
      ),
    db
      .select({
        tableId: tableSessionSignups.tableId,
        sessionId: tableSessionSignups.sessionId,
        playerId: tableSessionSignups.playerId,
        status: tableSessionSignups.status,
      })
      .from(tableSessionSignups)
      .where(inArray(tableSessionSignups.tableId, ids)),
  ]);
  const byTable = new Map<string, SessionWithPlayers[]>();
  for (const { tableId, status, id, ...session } of rows) {
    const list = byTable.get(tableId) ?? [];
    list.push({
      ...session,
      status: status as CalendarSession['status'],
      going: going
        .filter((row) => row.sessionId === id && row.status === 'going')
        .map((row) => row.playerId),
    });
    byTable.set(tableId, list);
  }
  return tables.map((table) => ({
    ...table,
    sessions: byTable.get(table.id) ?? [],
    signups: table.kind === 'open' && going.some((row) => row.tableId === table.id),
  }));
}

/**
 * The table as it goes in `personId`'s calendar. Quem mestra, and every player of a table that does
 * not sign up per session, get the whole table. A player of a campanha aberta that does gets only
 * the sessions they play: no weekly rule, the first of them as the event's start and the rest added
 * to it, or null when they play none ahead (nothing goes in their calendar; an invite cancels it).
 */
export function calendarFor<T extends CalendarTableWithSessions>(
  table: T,
  personId: string,
  gmId: string,
): T | null {
  if (!table.signups || personId === gmId) return table;
  const mine = table.sessions
    .filter(
      (session) =>
        session.status === 'scheduled' &&
        session.startsAt >= table.startsAt &&
        (session.going ?? []).includes(personId),
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const [first] = mine;
  if (!first) return null;
  return {
    ...table,
    startsAt: first.startsAt,
    durationMinutes: first.durationMinutes,
    recurrence: null,
    until: null,
    sessions: mine.map((session) => ({ ...session, movedFrom: null })),
  };
}
