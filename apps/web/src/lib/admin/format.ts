// How an admin list writes a moment: the day on one line and the time with its zone on the next, so
// a column of dates reads at a glance ("sáb, 4 out" over "19:00 GMT-3").

/** "sáb, 4 out" in the zone given, without the periods an abbreviation carries. */
export function dayLabel(date: Date, locale: string, timeZone?: string) {
  const parts = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value.replace(/\./g, '') ?? '';
  return `${part('weekday')}, ${part('day')} ${part('month')}`;
}

/** "19:00 GMT-3": the time and the zone it is in. */
export function timeLabel(date: Date, locale: string, timeZone?: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'shortOffset',
  }).format(date);
}

/** "04/10/2026": a date alone, for a sign-up. */
export function shortDate(date: Date, locale: string, timeZone?: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone }).format(date);
}
