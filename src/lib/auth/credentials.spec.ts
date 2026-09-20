import { describe, expect, it } from 'vitest';
import { parseCredentials } from './credentials';

const form = (fields: Record<string, string>) => {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
};

describe('parseCredentials', () => {
	it('accepts an email and a password of 8 characters or more', () => {
		expect(parseCredentials(form({ email: 'ana@example.com', password: 'correct horse' }))).toEqual(
			{
				ok: true,
				data: { email: 'ana@example.com', password: 'correct horse' }
			}
		);
	});

	it('trims the email and lowercases it, since addresses are matched that way', () => {
		const result = parseCredentials(form({ email: '  Ana@Example.COM ', password: '12345678' }));

		expect(result.ok && result.data.email).toBe('ana@example.com');
	});

	it('leaves the password exactly as typed, spaces included', () => {
		const result = parseCredentials(form({ email: 'a@b.co', password: '  spaced out  ' }));

		expect(result.ok && result.data.password).toBe('  spaced out  ');
	});

	it.each(['', 'ana', 'ana@', '@example.com', 'ana example@x.com', 'ana@example', 'a@b@c.co'])(
		'refuses %j as an email',
		(email) => {
			expect(parseCredentials(form({ email, password: '12345678' }))).toMatchObject({
				ok: false,
				errors: { email: expect.any(String) }
			});
		}
	);

	it.each([
		['', 'too short'],
		['1234567', 'one short of the minimum'],
		['x'.repeat(73), 'over 72 characters, which the hash would silently cut off']
	])('refuses a password of %j (%s)', (password) => {
		expect(parseCredentials(form({ email: 'a@b.co', password }))).toMatchObject({
			ok: false,
			errors: { password: expect.any(String) }
		});
	});

	it('accepts exactly 8 and exactly 72 characters', () => {
		expect(parseCredentials(form({ email: 'a@b.co', password: 'x'.repeat(8) })).ok).toBe(true);
		expect(parseCredentials(form({ email: 'a@b.co', password: 'x'.repeat(72) })).ok).toBe(true);
	});

	it('reports both problems at once', () => {
		const result = parseCredentials(form({ email: 'nope', password: 'x' }));

		expect(result.ok === false && Object.keys(result.errors).sort()).toEqual(['email', 'password']);
	});

	it('drops fields it does not list', () => {
		const result = parseCredentials(form({ email: 'a@b.co', password: '12345678', role: 'admin' }));

		expect(result.ok && Object.keys(result.data).sort()).toEqual(['email', 'password']);
	});
});
