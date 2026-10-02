import { and, eq, inArray, or } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, registrations } from '../db/schema';
import { nextOccurrence } from '../tables/schedule';
import type { CalendarTable } from './ics';

/**
 * The tables in a person's calendar: the active ones they run, and the active ones where they have
 * a confirmed seat (a pending request is not in the calendar yet). A table with no session left is
 * left out.
 */
export async function listCalendarTables(
  db: AnyDb,
  profileId: string,
  now: Date,
): Promise<CalendarTable[]> {
  const seated = db
    .select({ id: registrations.tableId })
    .from(registrations)
    .where(and(eq(registrations.playerId, profileId), eq(registrations.status, 'confirmed')));

  const rows = await db
    .select({
      id: gameTables.id,
      slug: gameTables.slug,
      title: gameTables.title,
      description: gameTables.description,
      extraInfo: gameTables.extraInfo,
      kind: gameTables.kind,
      startsAt: gameTables.startsAt,
      durationMinutes: gameTables.durationMinutes,
      timezone: gameTables.timezone,
      recurrence: gameTables.recurrence,
      until: gameTables.until,
      icalSequence: gameTables.icalSequence,
    })
    .from(gameTables)
    .where(
      and(
        eq(gameTables.status, 'active'),
        or(eq(gameTables.gmId, profileId), inArray(gameTables.id, seated)),
      ),
    );

  return rows.filter((row) => nextOccurrence(row, now) !== null);
}
