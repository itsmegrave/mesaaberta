// How a table's facts read on its pages (the card, the table page and its manage page). The dates
// and durations themselves are formatted in `@mesaaberta/core/tables/format`.
import { m } from '#lib/paraglide/messages.js';

export type TableKind = 'campaign' | 'one_shot' | 'adventure';

/** "Campanha", "Aventura", "One-shot". */
export const kindLabel = (kind: TableKind): string =>
  kind === 'campaign'
    ? m.table_kind_campaign()
    : kind === 'adventure'
      ? m.table_kind_adventure()
      : m.table_kind_one_shot();

/**
 * How often the table meets. A campaign always has a repeat rule (the database requires one) and
 * the form only writes weekly ones; `everyWeeks` is null when the rule is not one the platform reads
 * (`weeklyInterval`), and then nothing is said rather than guessing "weekly".
 */
export function scheduleLabel(kind: TableKind, everyWeeks: number | null): string | null {
  if (kind === 'adventure') return m.table_adventure_schedule();
  if (kind !== 'campaign') return m.table_recurrence_once();
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
