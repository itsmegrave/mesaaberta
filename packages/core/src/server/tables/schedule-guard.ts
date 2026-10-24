import { asc, eq, or, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables } from '../db/schema';
import { Invalid, NotFound } from '../errors';
import { intervalsOverlap } from './schedule';

type Session = { startsAt: Date; durationMinutes: number };

/** Serialize schedule writes by owner before discovering links, including a not-yet-created copy. */
export async function lockTableSchedule(db: AnyDb, gmId: string) {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${`table-schedule:${gmId}`}))`);
}

/** A table whose session will not happen does not hold its slot. */
const holdsSlot = (table: { status: string }) =>
  table.status !== 'disabled' && table.status !== 'not_held';

/**
 * Call after the owner lock, inside the write transaction. A table is constrained by its source and
 * copies, and by the other copies of its source. Tables that will not happen are ignored.
 */
export async function guardTableSchedule(db: AnyDb, tableId: string, proposed?: Session) {
  const [table] = await db.select().from(gameTables).where(eq(gameTables.id, tableId));
  if (!table) throw new NotFound();
  const parentId = table.duplicatedFromTableId;
  const linked = await db
    .select()
    .from(gameTables)
    .where(
      or(
        eq(gameTables.id, tableId),
        eq(gameTables.duplicatedFromTableId, tableId),
        ...(parentId
          ? [eq(gameTables.id, parentId), eq(gameTables.duplicatedFromTableId, parentId)]
          : []),
      ),
    )
    .orderBy(asc(gameTables.id))
    .for('update');
  const session = proposed ?? table;
  if (
    linked.some(
      (other) => other.id !== tableId && holdsSlot(other) && intervalsOverlap(session, other),
    )
  ) {
    throw new Invalid('startsAtLocal', 'schedule_conflict');
  }
}

/** The same rule for a copy that does not exist yet: its source and the source's other copies. */
export async function guardNewCopy(db: AnyDb, sourceId: string, proposed: Session) {
  const linked = await db
    .select()
    .from(gameTables)
    .where(or(eq(gameTables.id, sourceId), eq(gameTables.duplicatedFromTableId, sourceId)))
    .orderBy(asc(gameTables.id))
    .for('update');
  if (linked.some((other) => holdsSlot(other) && intervalsOverlap(proposed, other))) {
    throw new Invalid('startsAtLocal', 'schedule_conflict');
  }
}
