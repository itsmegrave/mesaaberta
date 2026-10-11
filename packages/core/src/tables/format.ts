/**
 * A session start as people say it, in the given timezone (the viewer's, see shownTimezone), with the
 * zone named so a player elsewhere can convert. Pass the timezone explicitly: without it the
 * server and the browser would each use their own and the page would change on hydration.
 */
export function formatSession(date: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'shortOffset',
  }).format(date);
}

/** A table's duration, stored in minutes, in hours as people say it: `180` is `3 horas`, `90` is `1,5 hora`. */
export function formatHours(minutes: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'hour',
    unitDisplay: 'long',
    maximumFractionDigits: 2,
  }).format(minutes / 60);
}

/** Minutes as the table form's hours, to the nearest half hour (older tables had 5-minute steps). */
export function minutesToHours(minutes: number): number {
  return Math.max(0.5, Math.round(minutes / 30) / 2);
}

/** A wait: `240` is `4 h`, `150` is `2 h 30 min`, `45` is `45 min`. */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return [hours && `${hours} h`, rest && `${rest} min`].filter(Boolean).join(' ');
}

/** How long to wait, rounded up to the minute so it never promises a moment too early: `90` is `2 min`. */
export function formatWait(seconds: number): string {
  return formatDuration(Math.max(1, Math.ceil(seconds / 60)));
}

/** Date formatting for table cards: day + short month ("26 set"), and weekday + time + offset. */
export function formatCardDate(
  date: Date,
  timeZone: string,
  locale: string,
): { dayMonth: string; weekdayTime: string } {
  const dayMonth = new Intl.DateTimeFormat(locale, {
    timeZone,
    day: 'numeric',
    month: 'short',
  }).format(date);

  const weekday = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
  }).format(date);

  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'shortOffset',
  }).format(date);

  return {
    // pt-BR writes "26 de set."; the card shows "26 set".
    dayMonth: dayMonth.replace(' de ', ' ').replace('.', '').trim(),
    // Monday to Friday end in "-feira" ("sexta-feira"); the card shows just "sexta".
    weekdayTime: `${weekday.replace(/-feira$/, '')} · ${time}`,
  };
}

/**
 * The instant a wall-clock time (`2026-10-10T19:00`) names in `timeZone`, for previews in the
 * browser; null when the text is not a complete date and time. The server has its own, exact one.
 */
export function zonedToDate(local: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  try {
    // What that UTC instant reads as in the zone; the difference is the zone's offset then.
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      })
        .formatToParts(new Date(guess))
        .map((part) => [part.type, Number(part.value)]),
    );
    const read = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    return new Date(guess - (read - guess));
  } catch {
    return null;
  }
}
