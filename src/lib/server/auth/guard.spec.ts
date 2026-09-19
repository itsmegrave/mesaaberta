import type { User } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { requireUser } from './guard';

const locals = (user: unknown) => ({ getUser: async () => user }) as App.Locals;

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
});
