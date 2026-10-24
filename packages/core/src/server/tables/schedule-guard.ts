import { asc, eq, inArray, or, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables } from '../db/schema';
import { Invalid, NotFound } from '../errors';
import { intervalsOverlap } from './schedule';

type Session = { startsAt: Date; durationMinutes: number };
type Table = typeof gameTables.$inferSelect;

/** Serialize schedule writes by owner before discovering links, including a not-yet-created copy. */
export async function lockTableSchedule(db: AnyDb, gmId: string) {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${`table-schedule:${gmId}`}))`);
}

/** Lock the complete set before touching an individual row; bulk writers use the same UUID order. */
export async function lockTableRows(db: AnyDb, tableIds: readonly string[]): Promise<Table[]> {
  if (!tableIds.length) return [];
  return db
    .select()
    .from(gameTables)
    .where(inArray(gameTables.id, [...new Set(tableIds)]))
    .orderBy(asc(gameTables.id))
    .for('update');
}

/** Call after the owner advisory lock, before any individual table row lock. */
export async function lockTableFamily(db: AnyDb, tableId: string, { newCopy = false } = {}) {
  const [source] = await db.select().from(gameTables).where(eq(gameTables.id, tableId));
  if (!source) throw new NotFound('table');
  const parentId = newCopy ? null : source.duplicatedFromTableId;
  const ids = await db
    .select({ id: gameTables.id })
    .from(gameTables)
    .where(
      or(
        eq(gameTables.id, tableId),
        eq(gameTables.duplicatedFromTableId, tableId),
        ...(parentId
          ? [eq(gameTables.id, parentId), eq(gameTables.duplicatedFromTableId, parentId)]
          : []),
      ),
    );
  const linked = await lockTableRows(
    db,
    ids.map(({ id }) => id),
  );
  const table = linked.find(({ id }) => id === tableId);
  if (!table) throw new NotFound('table');
  return { table, linked };
}

/** A table whose session will not happen does not hold its slot. */
const holdsSlot = (table: { status: string }) =>
  table.status !== 'disabled' && table.status !== 'not_held';

export function assertTableSchedule(
  linked: readonly Table[],
  proposed: Session,
  excludeId?: string,
) {
  if (
    linked.some(
      (other) => other.id !== excludeId && holdsSlot(other) && intervalsOverlap(proposed, other),
    )
  ) {
    throw new Invalid('startsAtLocal', 'schedule_conflict');
  }
}

/** Inactive subjects release their slots too; activation explicitly checks their proposed session. */
export async function guardTableSchedule(
  db: AnyDb,
  tableId: string,
  proposed?: Session,
  { activating = false } = {},
) {
  const family = await lockTableFamily(db, tableId);
  if (activating || holdsSlot(family.table)) {
    assertTableSchedule(family.linked, proposed ?? family.table, tableId);
  }
  return family.table;
}

/** The same rule for a copy that does not exist yet: its source and the source's other copies. */
export async function guardNewCopy(db: AnyDb, sourceId: string, proposed: Session) {
  const family = await lockTableFamily(db, sourceId, { newCopy: true });
  assertTableSchedule(family.linked, proposed);
}
