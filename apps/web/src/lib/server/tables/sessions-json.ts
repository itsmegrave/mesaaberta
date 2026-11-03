import type { SessionRow } from '@mesaaberta/core/server/tables/sessions';

/** A table's sessions as the api sent them: JSON turned the dates into strings. */
export const sessionsFromJson = (rows: SessionRow[]): SessionRow[] =>
  rows.map((row) => ({
    ...row,
    startsAt: new Date(row.startsAt),
    movedFrom: row.movedFrom ? new Date(row.movedFrom) : null,
  }));
