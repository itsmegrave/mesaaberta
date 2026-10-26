import { getLocale } from '#lib/paraglide/runtime.js';

const MINUTE_MS = 60_000;

/** "há 3 h", "ontem", "há 2 dias": how long ago, as short as the locale says it. */
export function agoLabel(at: Date, now: Date): string {
  const format = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto', style: 'short' });
  const minutes = Math.round((at.getTime() - now.getTime()) / MINUTE_MS);
  if (Math.abs(minutes) < 60) return format.format(Math.min(minutes, 0), 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return format.format(hours, 'hour');
  return format.format(Math.round(hours / 24), 'day');
}

/** "sáb., 1 de nov. às 19:00": a date and time in `timeZone`, short enough for a list. */
export const shortWhen = (at: Date, timeZone: string) =>
  new Intl.DateTimeFormat(getLocale(), {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(at);

/** The two lines of a session's date tile: "1 nov" and "sáb · 19:00". */
export function sessionTile(at: Date, timeZone: string) {
  const parts = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(getLocale(), { timeZone, ...options }).format(at).replace('.', '');
  return {
    day: parts({ day: 'numeric', month: 'short' }).replace(' de ', ' '),
    time: `${parts({ weekday: 'short' })} · ${parts({ hour: '2-digit', minute: '2-digit' })}`,
  };
}

/** The GMT offset a time zone is in now ("GMT-3"), for "Horários em GMT-3." */
export const zoneLabel = (timeZone: string, at: Date) =>
  new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
    .formatToParts(at)
    .find((part) => part.type === 'timeZoneName')?.value ?? timeZone;
