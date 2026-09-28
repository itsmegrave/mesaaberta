import { describe, expect, it } from 'vitest';
import { ratingSchema } from './rating';

const parseRatingForm = (data: FormData) => {
	const parsed = ratingSchema.safeParse(Object.fromEntries(data));
	if (!parsed.success) {
		const errors: Record<string, string> = {};
		for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
		return { ok: false as const, errors };
	}
	const { comment, ...scores } = parsed.data;
	return { ok: true as const, data: { ...scores, comment: comment || null } };
};

const form = (fields: Record<string, string>) => {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
};

describe('parseRatingForm', () => {
	it("accepts the GM's score from 1 to 5 and an optional comment", () => {
		expect(parseRatingForm(form({ gmScore: '3', comment: 'Ótima noite.' }))).toEqual({
			ok: true,
			data: { gmScore: 3, comment: 'Ótima noite.' }
		});
	});

	it('trims the comment, and an empty one becomes null', () => {
		const result = parseRatingForm(form({ gmScore: '4', comment: '   ' }));

		expect(result.ok && result.data.comment).toBeNull();
	});

	it.each(['0', '6', '2.5', '', 'muito', '-1'])(
		'refuses a score of %j, naming the field',
		(bad) => {
			expect(parseRatingForm(form({ gmScore: bad }))).toMatchObject({
				ok: false,
				errors: { gmScore: expect.any(String) }
			});
		}
	);

	it('refuses a comment over 1000 characters, and accepts exactly 1000', () => {
		expect(parseRatingForm(form({ gmScore: '3', comment: 'x'.repeat(1001) }))).toMatchObject({
			ok: false,
			errors: { comment: expect.any(String) }
		});
		expect(parseRatingForm(form({ gmScore: '3', comment: 'x'.repeat(1000) })).ok).toBe(true);
	});

	it("requires the GM's score", () => {
		const result = parseRatingForm(form({}));

		expect(result.ok === false && Object.keys(result.errors)).toEqual(['gmScore']);
	});

	it('drops fields it does not list, so a crafted request cannot set them', () => {
		const result = parseRatingForm(
			form({ gmScore: '3', tableScore: '5', playerId: 'x', createdAt: 'y' })
		);

		// Tables are not rated: a table score sent anyway is dropped with the rest.
		expect(result.ok && Object.keys(result.data).sort()).toEqual(['comment', 'gmScore']);
	});
});
