import { m } from '#lib/paraglide/messages.js';

/** One session as the table page and Gerenciar mesa list it (core's `SessionRow`). */
export type SessionItem = {
  id: string;
  number: number;
  startsAt: Date;
  durationMinutes: number;
  status: 'scheduled' | 'held' | 'not_held' | 'cancelled';
  note: string | null;
  movedFrom: Date | null;
  present: { count: number; of: number } | null;
  attended: boolean | null;
};

/** "sábado, 8 de novembro", with " · 19:00" after it when `time`. */
export function sessionDay(date: Date, timeZone: string, locale: string, time = false): string {
  const day = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  if (!time) return day;
  const at = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${day} · ${at}`;
}

/** "8 de novembro". */
export const shortDay = (date: Date, timeZone: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { timeZone, day: 'numeric', month: 'long' }).format(date);

/** What became of a session that is no longer ahead. */
export function outcomeLabel(status: SessionItem['status']): string {
  if (status === 'held') return m.sessions_outcome_held();
  if (status === 'not_held') return m.sessions_outcome_not_held();
  if (status === 'cancelled') return m.sessions_outcome_cancelled();
  return '';
}

/**
 * The sessions still ahead (scheduled, in order) and the ones behind (held, not held or
 * cancelled, newest first). A scheduled session whose date passed is the one waiting for quem
 * mestra's answer: it stays with the ones ahead.
 */
export function splitSessions(sessions: SessionItem[]) {
  return {
    upcoming: sessions.filter((session) => session.status === 'scheduled'),
    past: sessions.filter((session) => session.status !== 'scheduled').reverse(),
  };
}

/** What the clocks in `timeZone` read at `date`, as a form's `YYYY-MM-DDTHH:mm`. */
export function localInput(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
