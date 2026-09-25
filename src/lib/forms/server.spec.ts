import { describe, expect, it } from 'vitest';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import '$lib/forms/zod-codes';
import type { FormMessage } from './message';
import { refuse, withoutSecrets } from './server';

const schema = z.object({ email: z.string().min(3), password: z.string().min(8) });
const filled = () =>
	superValidate<z.infer<typeof schema>, FormMessage>(
		{ email: 'ana@example.com', password: 'a-long-password' },
		zod4(schema)
	);

describe('zod codes', () => {
	it('reports the code of the rule that failed, not English text', async () => {
		const form = await superValidate({ email: 'a', password: 'b' }, zod4(schema));

		expect(form.valid).toBe(false);
		expect(form.errors.email).toEqual(['too_small']);
		expect(form.errors.password).toEqual(['too_small']);
	});
});

describe('withoutSecrets', () => {
	it('empties the named fields and leaves the rest', async () => {
		const form = withoutSecrets(await filled(), ['password']);

		expect(form.data).toEqual({ email: 'ana@example.com', password: '' });
	});
});

describe('refuse', () => {
	it('puts the code on the field it names, when the form has that field', async () => {
		const result = refuse(await filled(), 400, 'invalid', 'email');

		expect(result).toMatchObject({
			status: 400,
			data: { form: { errors: { email: ['invalid'] } } }
		});
	});

	it('puts the code in the form message when the field is not in the schema, or none is named', async () => {
		const image = refuse(await filled(), 400, 'not_an_image', 'image');
		const plain = refuse(await filled(), 429, 'rate_limited');
		const prototype = refuse(await filled(), 400, 'invalid_field', '__proto__');

		expect(image).toMatchObject({
			status: 400,
			data: { form: { message: { code: 'not_an_image', field: 'image' } } }
		});
		expect(plain).toMatchObject({
			status: 429,
			data: { form: { message: { code: 'rate_limited' } } }
		});
		expect(prototype).toMatchObject({
			status: 400,
			data: { form: { message: { code: 'invalid_field', field: '__proto__' } } }
		});
	});
});
