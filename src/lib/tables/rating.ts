import { z } from 'zod';

export const MAX_COMMENT_LENGTH = 1000;

const score = z.coerce.number().int().min(1).max(5);

const form = z.object({
	tableScore: score,
	gmScore: score,
	comment: z.string().trim().max(MAX_COMMENT_LENGTH).default('')
});

export type RatingInput = { tableScore: number; gmScore: number; comment: string | null };

/** Validates the rating form: two scores from 1 to 5 and an optional comment. */
export function parseRatingForm(
	data: FormData
): { ok: true; data: RatingInput } | { ok: false; errors: Record<string, string> } {
	const parsed = form.safeParse(Object.fromEntries(data));

	if (!parsed.success) {
		const errors: Record<string, string> = {};
		for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.code;
		return { ok: false, errors };
	}

	const { comment, ...scores } = parsed.data;
	return { ok: true, data: { ...scores, comment: comment || null } };
}
