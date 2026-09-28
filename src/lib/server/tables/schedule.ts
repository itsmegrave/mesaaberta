// Dates, zones and repeats, on Temporal (the `temporal-polyfill` package: the Workers runtime has
// no built-in Temporal yet). This file is the domain layer: the rules about what a session is live
// here, and Temporal only does the calendar arithmetic.
import { Temporal } from 'temporal-polyfill';

export type Schedule = {
  kind: 'campaign' | 'one_shot';
  startsAt: Date;
  timezone: string;
  /** An iCalendar RRULE: only what the table form builds (see `RECURRENCE`). */
  recurrence: string | null;
  until: Date | null;
};

/**
 * The one repeat rule the system supports: weekly, optionally every `n` weeks (1–99). It is what
 * the table form writes, what `nextOccurrence` counts and the only rule an invite may carry. Any
 * other RRULE (DAILY, BYDAY, COUNT…) is refused rather than half understood.
 */
export const RECURRENCE = /^FREQ=WEEKLY(?:;INTERVAL=([1-9]\d?))?$/;

/** The weeks between sessions, or null for no recurrence or one outside `RECURRENCE`. */
export function weeklyInterval(recurrence: string | null): number | null {
  const match = recurrence ? RECURRENCE.exec(recurrence) : null;
  return match ? Number(match[1] ?? 1) : null;
}

// A wall-clock time that the clocks skip (the hour lost when they go forward) is read as the time
// after the gap; one they show twice (the hour repeated when they go back) as the earlier of the two.
// This is RFC 5545's rule for such times, and so what calendars do with the same invite.
const DISAMBIGUATION = 'compatible' as const;

const zoned = (instant: Date, timeZone: string) =>
  Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(timeZone);

/**
 * The start of the session at or after `now`, or null when there is none left: a one-shot that has
 * started, a campaign past its `until`, or one whose recurrence is not understood (which is then
 * treated as a single date rather than guessed at).
 *
 * A weekly session keeps its wall-clock time in the table's timezone, so it does not drift an hour
 * when the clocks change. The weekday is the one of `startsAt`.
 */
export function nextOccurrence(schedule: Schedule, now: Date): Date | null {
  const { startsAt, timezone, until } = schedule;
  const interval = schedule.kind === 'campaign' ? weeklyInterval(schedule.recurrence) : null;

  if (interval === null) return startsAt >= now ? startsAt : null;

  const start = zoned(startsAt, timezone);
  const occurrence = (n: number) => new Date(start.add({ weeks: interval * n }).epochMilliseconds);

  // Close to the answer in one step (a week is 7 × 24 h, give or take a DST hour), then walk forward.
  const week = 7 * 24 * 60 * 60 * 1000;
  let n = Math.max(0, Math.floor((now.getTime() - startsAt.getTime()) / (interval * week)) - 1);
  while (occurrence(n) < now) n++;

  const next = occurrence(n);
  return until && next > until ? null : next;
}

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
