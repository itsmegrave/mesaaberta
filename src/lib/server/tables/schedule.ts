// Dates, zones and repeats, on Temporal (the `temporal-polyfill` package: the Workers runtime has
// no built-in Temporal yet). This file is the domain layer: the rules about what a session is live
// here, and Temporal only does the calendar arithmetic.
//
// The platform does not track a campaign's later sessions. A table has one date, `startsAt`: it is
// open for seat requests until then, and the sweeper asks its GM whether it happened once its
// duration is over. The recurrence is information (and the repeat rule of the first invite).
import { Temporal } from 'temporal-polyfill';

/**
 * The one repeat rule the system supports: weekly, optionally every `n` weeks (1–99). It is what
 * the table form writes and the only rule an invite may carry. Any other RRULE (DAILY, BYDAY,
 * COUNT…) is refused rather than half understood.
 */
export const RECURRENCE = /^FREQ=WEEKLY(?:;INTERVAL=([1-9]\d?))?$/;

/** The weeks between sessions, or null for no recurrence or one outside `RECURRENCE`. */
export function weeklyInterval(recurrence: string | null): number | null {
  const match = recurrence ? RECURRENCE.exec(recurrence) : null;
  return match ? Number(match[1] ?? 1) : null;
}

/**
 * Whether the table's session has begun. From that instant nobody new can ask for a seat and the
 * table leaves the public lists, whatever its status says: the status only changes when the
 * sweeper runs, after the session's duration.
 */
export const hasStarted = (startsAt: Date, now: Date) => startsAt <= now;

// A wall-clock time that the clocks skip (the hour lost when they go forward) is read as the time
// after the gap; one they show twice (the hour repeated when they go back) as the earlier of the two.
// This is RFC 5545's rule for such times, and so what calendars do with the same invite.
const DISAMBIGUATION = 'compatible' as const;

const zoned = (instant: Date, timeZone: string) =>
  Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(timeZone);

/** The instant at which the clocks in `timeZone` read `local` (`2026-10-10T19:00`). */
export function localToInstant(local: string, timeZone: string): Date {
  const zonedTime = Temporal.PlainDateTime.from(local).toZonedDateTime(timeZone, {
    disambiguation: DISAMBIGUATION,
  });
  return new Date(zonedTime.epochMilliseconds);
}

/** What the clocks in `timeZone` read at `instant`, as `2026-10-10T19:00`: the form's own format. */
export function instantToLocal(instant: Date, timeZone: string): string {
  return zoned(instant, timeZone).toPlainDateTime().toString({ smallestUnit: 'minute' });
}
