import type { User } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { requireUser } from './guard';

const done = { username: 'ana' };
const locals = (user: unknown, profile: { username: string | null } | null = done) =>
	({ getUser: async () => user, getProfile: async () => profile }) as App.Locals;

describe('requireUser', () => {
	it('returns the signed-in user', async () => {
		const user = { id: 'u1' } as User;

		expect(await requireUser(locals(user), new URL('https://x.test/tables/new'))).toBe(user);
	});

	it('sends an anonymous visitor to log in, and back afterwards', async () => {
		await expect(
			requireUser(locals(null), new URL('https://x.test/tables/new?draft=1'))
		).rejects.toMatchObject({ status: 303, location: '/login?next=%2Ftables%2Fnew%3Fdraft%3D1' });
	});

	it.each([
		['a profile without a username', { username: null }],
		['no profile at all', null]
	])('sends %s to finish the profile, and back afterwards', async (_what, profile) => {
		await expect(
			requireUser(locals({ id: 'u1' }, profile), new URL('https://x.test/tables/new?draft=1'))
		).rejects.toMatchObject({
			status: 303,
			location: '/onboarding?next=%2Ftables%2Fnew%3Fdraft%3D1'
		});
	});

	it('lets the onboarding itself through with an incomplete profile', async () => {
		const user = { id: 'u1' } as User;

		expect(
			await requireUser(locals(user, { username: null }), new URL('https://x.test/onboarding'), {
				allowIncomplete: true
			})
		).toBe(user);
	});

	it('still sends an anonymous visitor to log in from the onboarding', async () => {
		await expect(
			requireUser(locals(null), new URL('https://x.test/onboarding'), { allowIncomplete: true })
		).rejects.toMatchObject({ status: 303 });
	});
});
