import { describe, expect, it } from 'vitest';
import { MAX_SOCIAL_LINKS } from './social-links';
import { profileLinks, profileSchema } from './schema';

const base = {
	username: 'ana',
	name: '',
	gender: '',
	city: '',
	age: null,
	linkNetwork: [],
	linkUrl: []
};

/** The codes the schema reported, keyed by the path they belong to (`linkUrl.1`). */
const problems = (input: object) => {
	const parsed = profileSchema.safeParse({ ...base, ...input });
	if (parsed.success) return null;

	return Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message]));
};

describe('profileSchema', () => {
	it('needs nothing but a username, and stores it lowercase', () => {
		const parsed = profileSchema.safeParse({ ...base, username: '  Ana-Maria ' });

		expect(parsed.data).toMatchObject({ username: 'ana-maria', name: '', age: null });
	});

	it('keeps the optional details, trimmed', () => {
		const parsed = profileSchema.safeParse({
			...base,
			name: '  Ana Maria ',
			age: 31,
			gender: ' mulher ',
			city: ' Recife '
		});

		expect(parsed.data).toMatchObject({
			name: 'Ana Maria',
			age: 31,
			gender: 'mulher',
			city: 'Recife'
		});
	});

	it.each([
		['', 'required'],
		['a', 'too_short'],
		['ana maria', 'invalid_chars'],
		['admin', 'reserved'],
		['ana--maria', 'hyphen_double'],
		['-ana', 'hyphen_edges'],
		['x'.repeat(31), 'too_long']
	])('refuses the username %j as %s', (username, code) => {
		expect(problems({ username })).toEqual({ username: code });
	});

	it.each([
		['age', 12],
		['age', 121],
		['age', 30.5],
		['name', 'x'.repeat(81)],
		['gender', 'x'.repeat(41)],
		['city', 'x'.repeat(81)]
	])('refuses %s %j', (field, value) => {
		expect(Object.keys(problems({ [field]: value }) ?? {})).toEqual([field]);
	});

	describe('social links', () => {
		it('says which row is wrong, counting the empty ones too, so the message lands on the right field', () => {
			expect(
				problems({
					linkNetwork: ['instagram', 'website', 'x'],
					linkUrl: ['https://instagram.com/ana', '', 'javascript:alert(1)']
				})
			).toEqual({ 'linkUrl.2': 'invalid_url' });
		});

		it('refuses an unknown network', () => {
			expect(problems({ linkNetwork: ['myspace'], linkUrl: ['https://example.com'] })).toEqual({
				'linkNetwork.0': 'invalid_network'
			});
		});

		it('refuses more than the limit', () => {
			const many = Array.from(
				{ length: MAX_SOCIAL_LINKS + 1 },
				(_, i) => `https://example.com/${i}`
			);

			expect(problems({ linkNetwork: many.map(() => 'website'), linkUrl: many })).toEqual({
				linkUrl: 'too_many'
			});
		});

		it('refuses the same address twice', () => {
			expect(
				problems({
					linkNetwork: ['website', 'website'],
					linkUrl: ['https://example.com/a', 'https://example.com/a']
				})
			).toEqual({ 'linkUrl.1': 'duplicate' });
		});

		it('refuses a request whose networks and addresses do not line up', () => {
			expect(problems({ linkNetwork: ['website'], linkUrl: [] })).toEqual({ linkUrl: 'invalid' });
		});
	});
});

describe('profileLinks', () => {
	it('gives the links in the order they were sent, without the empty rows, addresses normalised', () => {
		expect(
			profileLinks({
				linkNetwork: ['instagram', 'website', 'x'],
				linkUrl: ['instagram.com/ana', '', 'https://x.com/ana']
			})
		).toEqual([
			{ network: 'instagram', url: 'https://instagram.com/ana' },
			{ network: 'x', url: 'https://x.com/ana' }
		]);
	});
});
