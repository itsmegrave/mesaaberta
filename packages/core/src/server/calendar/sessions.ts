// Relative imports only: the invite handler bundles this file into the event-delivery graph.
import { and, eq, gte, inArray, or } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, tableSessions } from '../db/schema';
import type { CalendarSession, CalendarTable } from './ics';

/**
 * The tables with their sessions from the next one on (`CalendarTable.sessions`), so the calendar
 * shows a cancelled, moved or added session as the table page does. Cancelled dates before the
 * table's next session no longer matter and are left out.
 */
export async function withSessions<T extends CalendarTable>(db: AnyDb, tables: T[]): Promise<T[]> {
  if (tables.length === 0) return tables;
  const rows = await db
    .select({
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
        inArray(
          tableSessions.tableId,
          tables.map((table) => table.id),
        ),
        or(
          eq(tableSessions.status, 'scheduled'),
          and(
            eq(tableSessions.status, 'cancelled'),
            gte(tableSessions.startsAt, gameTables.startsAt),
          ),
        ),
      ),
    );
  const byTable = new Map<string, CalendarSession[]>();
  for (const { tableId, status, ...session } of rows) {
    const list = byTable.get(tableId) ?? [];
    list.push({ ...session, status: status as CalendarSession['status'] });
    byTable.set(tableId, list);
  }
  return tables.map((table) => ({ ...table, sessions: byTable.get(table.id) ?? [] }));
}
