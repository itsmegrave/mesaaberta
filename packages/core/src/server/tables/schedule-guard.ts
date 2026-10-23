import { asc, eq, or, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables } from '../db/schema';
import { Invalid } from '../errors';
import { intervalsOverlap } from './schedule';

type Session = { startsAt: Date; durationMinutes: number };

/** Serialize schedule writes by owner before discovering links, including a not-yet-created copy. */
export async function lockTableSchedule(db: AnyDb, gmId: string) {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${`table-schedule:${gmId}`}))`);
}

/** Call after the owner lock, inside the write transaction. Only immediate links constrain dates. */
export async function guardTableSchedule(db: AnyDb, tableId: string, proposed?: Session) {
  const [table] = await db.select().from(gameTables).where(eq(gameTables.id, tableId));
  const linked = await db
    .select()
    .from(gameTables)
    .where(
      or(
        eq(gameTables.id, tableId),
        eq(gameTables.duplicatedFromTableId, tableId),
        ...(table.duplicatedFromTableId ? [eq(gameTables.id, table.duplicatedFromTableId)] : []),
      ),
    )
    .orderBy(asc(gameTables.id))
    .for('update');
  const session = proposed ?? table;
  if (linked.some((other) => other.id !== tableId && intervalsOverlap(session, other))) {
    throw new Invalid('startsAtLocal', 'schedule_conflict');
  }
}
