import '../forms/zod-codes';
import { z } from 'zod';

export const MAX_COMMENT_LENGTH = 1000;

const score = z.coerce.number().int().min(1).max(5);

// Only the GM is rated: a table is one night or one campaign, the GM is who players come back to.
export const ratingSchema = z.object({
  gmScore: score,
  comment: z.string().trim().max(MAX_COMMENT_LENGTH).default(''),
});

export type RatingInput = { gmScore: number; comment: string | null };

// The GM's rating of one player they marked present. The comment is the GM's own note.
export const playerRatingSchema = z.object({
  playerId: z.guid(),
  score,
  comment: z.string().trim().max(MAX_COMMENT_LENGTH).default(''),
});

export type PlayerRatingInput = { score: number; comment: string | null };
