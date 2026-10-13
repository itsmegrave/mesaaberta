import '$lib/forms/zod-codes';
import { z } from 'zod';
import { next } from '$lib/forms/next';
import { isLocalDateTime } from './schema';

/** "It happened" and "it did not": only where to come back to. */
export const answerSchema = z.object({ next });

/** Postponing: the new start, as wall-clock time in the table's zone (`2026-10-10T19:00`). */
export const postponeSchema = z.object({
  startsAtLocal: z.string().refine(isLocalDateTime, 'invalid'),
  next,
});
