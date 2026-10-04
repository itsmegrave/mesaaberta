import { and, eq, gt, inArray, or } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, registrations } from '../db/schema';
import type { CalendarTable } from './ics';

/**
 * The tables in a person's calendar: the active ones they run, and the active ones where they have
 * a confirmed seat (a pending request is not in the calendar yet). A table whose session has
 * begun is left out.
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

  return db
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
        gt(gameTables.startsAt, now),
        or(eq(gameTables.gmId, profileId), inArray(gameTables.id, seated)),
      ),
    );
}
