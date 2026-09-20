import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { profiles } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { ensureProfile } from './profile';

let test: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => (test = await createTestDb()));
afterAll(() => test.close());

const id = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;
const user = (n: number, metadata: Record<string, unknown> = {}) => ({
	id: id(n),
	user_metadata: metadata
});

describe('ensureProfile', () => {
	it('creates a member profile from the provider name and picture on first login', async () => {
		const profile = await ensureProfile(
			test.db,
			user(1, { full_name: 'Ana Souza', avatar_url: 'https://cdn.example/ana.png' })
		);

		expect(profile).toMatchObject({
			id: id(1),
			displayName: 'Ana Souza',
			avatarUrl: 'https://cdn.example/ana.png',
			role: 'member',
			status: 'active'
		});
	});

	it.each([
		[11, 'name', { name: 'Bruno' }, 'Bruno'],
		[12, 'user_name', { user_name: 'bruno-gh' }, 'bruno-gh']
	])('takes the display name from %s', async (n, _what, metadata, expected) => {
		const profile = await ensureProfile(test.db, user(n, metadata));

		expect(profile.displayName).toBe(expected);
	});

	it.each([
		[13, 'avatar_url', { avatar_url: 'https://cdn.example/a.png' }, 'https://cdn.example/a.png'],
		[14, 'picture (Google)', { picture: 'https://cdn.example/c.png' }, 'https://cdn.example/c.png'],
		[15, 'anything that is not https', { avatar_url: 'javascript:alert(1)' }, null]
	])('takes the avatar from %s', async (n, _what, metadata, expected) => {
		const profile = await ensureProfile(test.db, user(n, metadata));

		expect(profile.avatarUrl).toBe(expected);
	});

	it('does not derive a name from the email address, which is personal data', async () => {
		const profile = await ensureProfile(test.db, user(2, { email: 'ana@example.com' }));

		expect(profile.displayName).toBe('Jogador');
		expect(JSON.stringify(profile)).not.toContain('ana@example.com');
	});

	it('trims and shortens an absurd display name', async () => {
		const profile = await ensureProfile(test.db, user(3, { name: `  ${'x'.repeat(200)}  ` }));

		expect(profile.displayName).toBe('x'.repeat(60));
	});

	it('leaves an existing profile untouched on later logins, role included', async () => {
		await ensureProfile(test.db, user(4, { name: 'Original' }));
		await test.db
			.update(profiles)
			.set({ role: 'admin' })
			.where(eq(profiles.id, id(4)));

		const again = await ensureProfile(test.db, user(4, { name: 'Renamed at the provider' }));

		expect(again).toMatchObject({ displayName: 'Original', role: 'admin' });
	});

	it('creates one profile even when two first logins race', async () => {
		const [a, b] = await Promise.all([
			ensureProfile(test.db, user(5, { name: 'Dani' })),
			ensureProfile(test.db, user(5, { name: 'Dani' }))
		]);

		expect(a.id).toBe(b.id);
		expect(
			await test.db
				.select()
				.from(profiles)
				.where(eq(profiles.id, id(5)))
		).toHaveLength(1);
	});
});
