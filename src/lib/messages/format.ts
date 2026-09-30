import { m } from '$lib/paraglide/messages';
import { dayKey } from './group';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Time of day, 24 hours: `14:05`. */
export const clock = (date: Date, locale: string, timeZone?: string) =>
  new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);

/** A day's name for a separator: Hoje, Ontem, or the date. */
export function dayLabel(date: Date, now: Date, locale: string, timeZone?: string): string {
  const key = dayKey(date, timeZone);
  if (key === dayKey(now, timeZone)) return m.messages_today();
  if (key === dayKey(new Date(now.getTime() - DAY_MS), timeZone)) return m.messages_yesterday();
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  }).format(date);
}

/** The short time for an inbox row: the clock today, Ontem, then the weekday or the date. */
export function shortTime(date: Date, now: Date, locale: string, timeZone?: string): string {
  const key = dayKey(date, timeZone);
  if (key === dayKey(now, timeZone)) return clock(date, locale, timeZone);
  if (key === dayKey(new Date(now.getTime() - DAY_MS), timeZone)) return m.messages_yesterday();
  if (now.getTime() - date.getTime() < 6 * DAY_MS)
    return new Intl.DateTimeFormat(locale, { timeZone, weekday: 'short' })
      .format(date)
      .replace('.', '');
  return new Intl.DateTimeFormat(locale, { timeZone, day: '2-digit', month: '2-digit' }).format(
    date,
  );
}
