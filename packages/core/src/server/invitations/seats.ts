import { sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, playerInvitations, registrations } from '../db/schema';

/** One clock per read: expired reservations release seats even before the sweeper runs. */
export const reservedSeatsSql = (tableId: typeof gameTables.id | string, now: Date) =>
  sql<number>`(select count(*)::int from ${playerInvitations} where ${playerInvitations.tableId} = ${typeof tableId === 'string' ? tableId : sql.raw('"game_tables"."id"')} and ${playerInvitations.status} = 'pending' and ${playerInvitations.expiresAt} > ${now.toISOString()}::timestamptz)`;

export async function seatAvailability(db: AnyDb, tableId: string, now: Date) {
  const [row] = await db
    .select({
      capacity: gameTables.capacity,
      confirmed: sql<number>`(select count(*)::int from ${registrations} where ${registrations.tableId} = ${gameTables.id} and ${registrations.status} = 'confirmed')`,
      reserved: reservedSeatsSql(gameTables.id, now),
    })
    .from(gameTables)
    .where(sql`${gameTables.id} = ${tableId}`);
  return {
    confirmed: row?.confirmed ?? 0,
    reserved: row?.reserved ?? 0,
    available: row ? Math.max(0, row.capacity - row.confirmed - row.reserved) : 0,
  };
}
