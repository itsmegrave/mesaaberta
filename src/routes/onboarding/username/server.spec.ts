import type { RequestEvent } from '@sveltejs/kit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { profiles } from '$lib/server/db/schema';
import { createTestDb } from '$lib/server/db/test-db';
import { GET } from './+server';

let test: Awaited<ReturnType<typeof createTestDb>>;
const me = '00000000-0000-4000-8000-000000000601';
const other = '00000000-0000-4000-8000-000000000602';

beforeAll(async () => {
	test = await createTestDb();
	await test.db.insert(profiles).values([
		{ id: me, username: 'eu-mesmo' },
		{ id: other, username: 'bruno' }
	]);
});
afterAll(() => test.close());

const ask = async (value: string | null, { signedIn = true } = {}) => {
	const url = new URL('https://x.test/onboarding/username');
	if (value !== null) url.searchParams.set('value', value);
	const event = {
		url,
		locals: { db: test.db, userId: me, getUser: async () => (signedIn ? { id: me } : null) }
	} as unknown as RequestEvent;

	return GET(event as never);
};

describe('the username availability endpoint', () => {
	it.each([
		['bruno', 'taken'],
		['  BRUNO ', 'taken'],
		['livre', 'free'],
		['admin', 'invalid'],
		['a', 'invalid'],
		['com espaço', 'invalid']
	])('answers %j with %s, and nothing more', async (value, status) => {
		const response = await ask(value);

		expect(await response.json()).toEqual({ status });
		expect(response.headers.get('cache-control')).toBe('no-store');
	});

	it("does not call a person's own username taken", async () => {
		expect(await (await ask('eu-mesmo')).json()).toEqual({ status: 'free' });
	});

	it('answers a missing value as invalid', async () => {
		expect(await (await ask(null)).json()).toEqual({ status: 'invalid' });
	});

	it('is for people who are signed in', async () => {
		await expect(ask('bruno', { signedIn: false })).rejects.toMatchObject({ status: 401 });
	});
});
