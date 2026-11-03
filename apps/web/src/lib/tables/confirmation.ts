import '@mesaaberta/core/forms/zod-codes';
import { z } from 'zod';
import { next } from '#lib/forms/next.js';
import { isLocalDateTime, TABLE_LIMITS } from '@mesaaberta/core/tables/schema';

/** "It happened" and "it did not": only where to come back to. */
export const answerSchema = z.object({ next });

/** Postponing: the new start, as wall-clock time in the table's zone (`2026-10-10T19:00`). */
export const postponeSchema = z.object({
  startsAtLocal: z.string().refine(isLocalDateTime, 'invalid'),
  next,
});

/**
 * A session that happened with more to come: when the next one is, as wall-clock time in the
 * table's zone. Blank for a campaign takes its next weekly date; an adventure needs one.
 */
export const heldSchema = z.object({
  nextStartsAtLocal: z
    .string()
    .refine((value) => value === '' || isLocalDateTime(value), 'invalid'),
  next,
});

/** Quem mestra's note on one session. */
const sessionNote = z.string().max(TABLE_LIMITS.sessionNote).default('');
const sessionId = z.uuid();

/** "Agendar sessão": the day and time in the table's zone, its length in hours and a note. */
export const scheduleSessionSchema = z.object({
  startsAtLocal: z.string().refine(isLocalDateTime, 'invalid'),
  durationHours: z.coerce
    .number()
    .min(TABLE_LIMITS.durationHours.min)
    .max(TABLE_LIMITS.durationHours.max),
  note: sessionNote,
  next,
});

/** "Mudar data": the session and its new day and time. */
export const moveSessionSchema = z.object({
  sessionId,
  startsAtLocal: z.string().refine(isLocalDateTime, 'invalid'),
  next,
});

/** "Escrever nota": the session and its note (blank clears it). */
export const noteSessionSchema = z.object({ sessionId, note: sessionNote, next });

/** "Cancelar sessão": the session and an optional message to the players. */
export const cancelSessionSchema = z.object({ sessionId, message: sessionNote, next });

/** Campanha aberta: quem mestra puts a player from the roster in a session, or takes them out. */
export const sessionPlayerSchema = z.object({ sessionId, playerId: z.guid(), next });
