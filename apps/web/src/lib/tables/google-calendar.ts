// "Adicionar à agenda" › "Google Agenda": a link that opens Google Calendar with the table filled
// in. It is what works on Android, where the Google Calendar app does not import a downloaded
// `.ics`. Only what the page already shows goes in; the join details stay on the page.

export type GoogleCalendarTable = {
  title: string;
  startsAt: Date;
  durationMinutes: number;
  timezone: string;
  /** The table form's rule, `FREQ=WEEKLY` with an optional `;INTERVAL=n`, or null. */
  recurrence: string | null;
  until: Date | null;
};

const pad = (value: number) => String(value).padStart(2, '0');

/** What the clocks in `timeZone` read at `instant`, as `20261108T190000`. */
function wallClock(instant: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

/** `instant` in UTC, as an iCalendar date-time (`20261231T235959Z`). */
const utc = (instant: Date) =>
  `${instant.getUTCFullYear()}${pad(instant.getUTCMonth() + 1)}${pad(instant.getUTCDate())}T${pad(
    instant.getUTCHours(),
  )}${pad(instant.getUTCMinutes())}${pad(instant.getUTCSeconds())}Z`;

/**
 * The Google Calendar "new event" address for a table: the times are the table's own wall clock
 * with its zone (`ctz`), so a weekly table keeps its hour through a change of daylight time, and
 * the weekly rule goes in `recur`. Only the rule the table form writes is passed on.
 */
export function googleCalendarHref(table: GoogleCalendarTable, tableUrl: string): string {
  const end = new Date(table.startsAt.getTime() + table.durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: table.title,
    dates: `${wallClock(table.startsAt, table.timezone)}/${wallClock(end, table.timezone)}`,
    ctz: table.timezone,
    details: tableUrl,
  });
  if (table.recurrence && /^FREQ=WEEKLY(?:;INTERVAL=[1-9]\d?)?$/.test(table.recurrence)) {
    const until = table.until ? `;UNTIL=${utc(table.until)}` : '';
    params.set('recur', `RRULE:${table.recurrence}${until}`);
  }
  return `https://calendar.google.com/calendar/render?${params}`;
}
