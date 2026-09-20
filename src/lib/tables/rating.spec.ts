import { describe, expect, it } from 'vitest';
import { parseRatingForm } from './rating';

const form = (fields: Record<string, string>) => {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
};

describe('parseRatingForm', () => {
	it('accepts two scores from 1 to 5 and an optional comment', () => {
		expect(
			parseRatingForm(form({ tableScore: '5', gmScore: '3', comment: 'Ótima noite.' }))
		).toEqual({
			ok: true,
			data: { tableScore: 5, gmScore: 3, comment: 'Ótima noite.' }
		});
	});

	it('trims the comment, and an empty one becomes null', () => {
		const result = parseRatingForm(form({ tableScore: '4', gmScore: '4', comment: '   ' }));

		expect(result.ok && result.data.comment).toBeNull();
	});

	it.each(['0', '6', '2.5', '', 'muito', '-1'])(
		'refuses a score of %j, naming the field',
		(bad) => {
			const one = parseRatingForm(form({ tableScore: bad, gmScore: '3' }));
			const other = parseRatingForm(form({ tableScore: '3', gmScore: bad }));

			expect(one).toMatchObject({ ok: false, errors: { tableScore: expect.any(String) } });
			expect(other).toMatchObject({ ok: false, errors: { gmScore: expect.any(String) } });
		}
	);

	it('refuses a comment over 1000 characters, and accepts exactly 1000', () => {
		expect(
			parseRatingForm(form({ tableScore: '3', gmScore: '3', comment: 'x'.repeat(1001) }))
		).toMatchObject({
			ok: false,
			errors: { comment: expect.any(String) }
		});
		expect(
			parseRatingForm(form({ tableScore: '3', gmScore: '3', comment: 'x'.repeat(1000) })).ok
		).toBe(true);
	});

	it('requires both scores, and reports both at once', () => {
		const result = parseRatingForm(form({}));

		expect(result.ok).toBe(false);
		expect(result.ok === false && Object.keys(result.errors).sort()).toEqual([
			'gmScore',
			'tableScore'
		]);
	});

	it('drops fields it does not list, so a crafted request cannot set them', () => {
		const result = parseRatingForm(
			form({ tableScore: '3', gmScore: '3', playerId: 'x', createdAt: 'y' })
		);

		expect(result.ok && Object.keys(result.data).sort()).toEqual([
			'comment',
			'gmScore',
			'tableScore'
		]);
	});
});
