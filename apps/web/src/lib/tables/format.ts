// How a table's facts read on its pages (the card, the table page and its manage page). The dates
// and durations themselves are formatted in `@mesaaberta/core/tables/format`.
import { m } from '#lib/paraglide/messages.js';

export type TableKind = 'campaign' | 'one_shot' | 'adventure' | 'open';

/**
 * "Campanha", "Aventura", "One-shot", "Mesa aberta"; "Aventura · 4 sessões" with an adventure's
 * planned count.
 */
export const kindLabel = (kind: TableKind, plannedSessions: number | null = null): string =>
  kind === 'open'
    ? m.table_kind_open()
    : kind === 'campaign'
      ? m.table_kind_campaign()
      : kind === 'adventure'
        ? plannedSessions
          ? m.table_kind_adventure_sessions({ count: plannedSessions })
          : m.table_kind_adventure()
        : m.table_kind_one_shot();

/**
 * How often the table meets. A campaign always has a repeat rule (the database requires one) and
 * the form only writes weekly ones; `everyWeeks` is null when the rule is not one the platform reads
 * (`weeklyInterval`), and then nothing is said rather than guessing "weekly".
 */
export function scheduleLabel(
  kind: TableKind,
  everyWeeks: number | null,
  plannedSessions: number | null = null,
): string | null {
  if (kind === 'adventure')
    return plannedSessions
      ? m.table_adventure_schedule_count({ count: plannedSessions })
      : m.table_adventure_schedule();
  // A westmarch without a rhythm: the GM sets each next date.
  if (kind === 'open' && !everyWeeks) return m.table_open_schedule();
  if (kind !== 'campaign' && kind !== 'open') return m.table_recurrence_once();
  if (everyWeeks === 1) return m.table_recurrence_weekly();
  return everyWeeks ? m.table_recurrence_weeks({ weeks: everyWeeks }) : null;
}

/** The seats in words, when invites hold some: "2 confirmadas · 1 reservada · 2 livres". */
export const seatSummary = (confirmed: number, reserved: number, free: number): string =>
  [
    m.seats_confirmed({ count: confirmed }),
    m.seats_reserved({ count: reserved }),
    m.seats_free({ count: free }),
  ].join(' · ');

/** "Mesa cheia" or how many seats are left. */
export const seatsLeftLabel = (seatsLeft: number): string =>
  seatsLeft === 0 ? m.table_full() : m.table_seats_left({ count: seatsLeft });

/** The calendar tile next to the session: "SÁB / 26 / SET" (shown upper case), in `timeZone`. */
export function dateBox(startsAt: Date, timeZone: string, locale: string) {
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(startsAt).replace('.', '');
  return {
    weekday: part({ weekday: 'short' }),
    day: part({ day: 'numeric' }),
    month: part({ month: 'short' }),
  };
}

const MINUTE_MS = 60_000;

/**
 * How long ago a table was published, against `now` (the instant its list was read): "Aberta
 * agora", "há 25 min", "há 3 h", "ontem", "há 6 dias".
 */
export function openedLabel(publishedAt: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - publishedAt.getTime()) / MINUTE_MS));
  if (minutes < 1) return m.table_opened_now();
  if (minutes < 60) return m.table_opened_minutes({ count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return m.table_opened_hours({ count: hours });
  const days = Math.floor(hours / 24);
  return days === 1 ? m.table_opened_yesterday() : m.table_opened_days({ count: days });
}
