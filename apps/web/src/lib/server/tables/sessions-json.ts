import type { SessionRow } from '@mesaaberta/core/server/tables/sessions';

/**
 * A table's sessions as the api sent them: JSON turned the dates into strings. `seats` (campanha
 * aberta's places) only while `use_session_signup` is on.
 */
export const sessionsFromJson = (rows: SessionRow[], seats = false): SessionRow[] =>
  rows.map((row) => ({
    ...row,
    startsAt: new Date(row.startsAt),
    movedFrom: row.movedFrom ? new Date(row.movedFrom) : null,
    seats: seats ? (row.seats ?? null) : null,
  }));
