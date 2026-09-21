import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { profileSocialLinks, profiles } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { Invalid, NotFound } from '../errors';
import { isUsernameAvailable, loadProfileForm, saveProfile } from './service';
import type { ProfileInput } from '$lib/profile/schema';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000004${String(n).padStart(2, '0')}`;

beforeAll(async () => {
	test = await createTestDb();
	await test.db
		.insert(profiles)
		.values([{ id: id(1) }, { id: id(2) }, { id: id(3), username: 'bruno' }]);
});
afterAll(() => test.close());

const input = (over: Partial<ProfileInput> = {}): ProfileInput => ({
	username: 'ana',
	name: '',
	age: null,
	gender: '',
	city: '',
	linkNetwork: [],
	linkUrl: [],
	...over
});

describe('saveProfile', () => {
	it('stores the username alone, blanks as nothing', async () => {
		await saveProfile(test.db, id(1), input({ username: 'ana' }));

		const [profile] = await test.db
			.select()
			.from(profiles)
			.where(eq(profiles.id, id(1)));
		expect(profile).toMatchObject({
			username: 'ana',
			name: null,
			age: null,
			gender: null,
			city: null
		});
	});

	it('stores the details and the links in the order sent, and a later save replaces them', async () => {
		await saveProfile(
			test.db,
			id(2),
			input({
				username: 'carla',
				name: 'Carla Dias',
				age: 30,
				gender: 'mulher',
				city: 'Recife',
				linkNetwork: ['instagram', 'website', 'x'],
				linkUrl: ['instagram.com/carla', '', 'https://x.com/carla']
			})
		);

		expect(await loadProfileForm(test.db, id(2))).toEqual({
			username: 'carla',
			name: 'Carla Dias',
			age: 30,
			gender: 'mulher',
			city: 'Recife',
			linkNetwork: ['instagram', 'x'],
			linkUrl: ['https://instagram.com/carla', 'https://x.com/carla']
		});

		await saveProfile(
			test.db,
			id(2),
			input({ username: 'carla', linkNetwork: ['x'], linkUrl: ['https://x.com/carla2'] })
		);

		const links = await test.db
			.select()
			.from(profileSocialLinks)
			.where(eq(profileSocialLinks.profileId, id(2)));
		expect(links).toHaveLength(1);
		expect(links[0]).toMatchObject({ network: 'x', url: 'https://x.com/carla2', position: 0 });
	});

	it('says the username is taken, whatever its case, and leaves the profile as it was', async () => {
		await expect(
			saveProfile(test.db, id(1), input({ username: 'BRUNO', name: 'Nova' }))
		).rejects.toEqual(
			expect.objectContaining({ name: 'Invalid', field: 'username', message: 'taken' })
		);

		const [profile] = await test.db
			.select()
			.from(profiles)
			.where(eq(profiles.id, id(1)));
		expect(profile).toMatchObject({ username: 'ana', name: null });
	});

	it('lets someone keep their own username while changing something else', async () => {
		await saveProfile(test.db, id(1), input({ username: 'ana', city: 'Natal' }));

		const [profile] = await test.db
			.select()
			.from(profiles)
			.where(eq(profiles.id, id(1)));
		expect(profile).toMatchObject({ username: 'ana', city: 'Natal' });
	});

	it('refuses a profile that does not exist', async () => {
		await expect(saveProfile(test.db, id(99), input())).rejects.toBeInstanceOf(NotFound);
	});

	it('is not an Invalid error for anything but the username', async () => {
		await expect(
			saveProfile(test.db, id(1), input({ username: '-bad' }))
		).rejects.not.toBeInstanceOf(Invalid);
	});
});

describe('isUsernameAvailable', () => {
	it('is false for a taken username, whatever its case, and true for a free one', async () => {
		expect(await isUsernameAvailable(test.db, 'bruno')).toBe(false);
		expect(await isUsernameAvailable(test.db, ' Bruno ')).toBe(false);
		expect(await isUsernameAvailable(test.db, 'livre')).toBe(true);
	});

	it("does not count the person's own username as taken", async () => {
		expect(await isUsernameAvailable(test.db, 'bruno', { exceptProfileId: id(3) })).toBe(true);
	});
});

describe('loadProfileForm', () => {
	it('is null for a profile that does not exist, and empty text for what was never filled', async () => {
		expect(await loadProfileForm(test.db, id(98))).toBeNull();
		expect(await loadProfileForm(test.db, id(3))).toMatchObject({
			username: 'bruno',
			name: '',
			age: null,
			linkNetwork: []
		});
	});
});
