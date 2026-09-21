import '$lib/forms/zod-codes';
import { z } from 'zod';

export const MAX_COMMENT_LENGTH = 1000;

const score = z.coerce.number().int().min(1).max(5);

export const ratingSchema = z.object({
	tableScore: score,
	gmScore: score,
	comment: z.string().trim().max(MAX_COMMENT_LENGTH).default('')
});

export type RatingInput = { tableScore: number; gmScore: number; comment: string | null };
