import { and, eq } from 'drizzle-orm';
import { registrations } from '../db/schema';

/**
 * Whether a seat is one the GM marked present at a session of its table. Only these players can
 * be let to rate a table that goes on, and only these can be rated by the GM.
 */
export const markedPresent = (seat: { status: string | null; attended: boolean | null }): boolean =>
  seat.status === 'confirmed' && seat.attended === true;

/** `markedPresent` as a `registrations` condition, for the seats of `tableId`. */
export const markedPresentAt = (tableId: string) =>
  and(
    eq(registrations.tableId, tableId),
    eq(registrations.status, 'confirmed'),
    eq(registrations.attended, true),
  );
