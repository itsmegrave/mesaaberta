/** A `YYYY-MM-DD` date as "5 out": read in UTC so it is the same day wherever it is shown. */
export function shortDay(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`))
    .replace(/\./g, '');
}

/** A `YYYY-MM-DD` date as "5 de out. de 2026". */
export function longDay(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** "5 out – 25 out": the span of a campaign, the year only when the two ends differ in it. */
export function periodLabel(startsOn: string, endsOn: string, locale: string) {
  const sameYear = startsOn.slice(0, 4) === endsOn.slice(0, 4);
  const end = sameYear ? shortDay(endsOn, locale) : longDay(endsOn, locale);
  const start = sameYear ? shortDay(startsOn, locale) : longDay(startsOn, locale);
  return `${start} – ${end}`;
}
