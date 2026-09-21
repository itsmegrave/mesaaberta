import { afterAll, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';
import { openIntegrationDb } from '../db/integration-db';
import { profiles } from '../db/schema';
import { saveProfile } from './service';
import type { ProfileInput } from '$lib/profile/schema';

// Real Postgres, real concurrency: the unique index must decide when two people take a username at
// the same moment. PGlite is one connection and cannot make two transactions overlap.

const { db, close } = openIntegrationDb();
const created: string[] = [];

const newProfile = async () => {
	const id = crypto.randomUUID();
	await db.insert(profiles).values({ id });
	created.push(id);
	return id;
};

const form = (username: string): ProfileInput => ({
	username,
	name: '',
	age: null,
	gender: '',
	city: '',
	linkNetwork: [],
	linkUrl: []
});

afterAll(async () => {
	if (created.length) await db.delete(profiles).where(inArray(profiles.id, created));
	await close();
});

describe('taking a username', () => {
	it('gives it to exactly one of two people who ask at the same moment, and tells the other it is taken', async () => {
		const username = `it-${crypto.randomUUID().slice(0, 8)}`;
		const [a, b] = [await newProfile(), await newProfile()];

		const results = await Promise.allSettled([
			saveProfile(db, a, form(username)),
			saveProfile(db, b, form(username.toUpperCase()))
		]);

		const lost = results.filter((r) => r.status === 'rejected');
		expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
		expect(lost).toHaveLength(1);
		expect(lost[0].reason).toMatchObject({ name: 'Invalid', field: 'username', message: 'taken' });
	});

	it('is safe to repeat, and with many people at once', async () => {
		for (let round = 0; round < 3; round++) {
			const username = `it-${crypto.randomUUID().slice(0, 8)}`;
			const people = await Promise.all(Array.from({ length: 8 }, newProfile));

			const results = await Promise.allSettled(
				people.map((id) => saveProfile(db, id, form(username)))
			);

			expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
			for (const r of results.filter((r) => r.status === 'rejected')) {
				expect(r.reason).toMatchObject({ name: 'Invalid', field: 'username' });
			}
		}
	});
});
