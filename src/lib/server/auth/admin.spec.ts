import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { profiles } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { promoteToAdmin } from './admin';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = '00000000-0000-4000-8000-000000000401';
const other = '00000000-0000-4000-8000-000000000402';

beforeAll(async () => {
	test = await createTestDb();
	await test.db.insert(profiles).values([
		{ id, displayName: 'Ana' },
		{ id: other, displayName: 'Bruno' }
	]);
});
afterAll(() => test.close());

const roleOf = async (userId: string) =>
	(await test.db.select().from(profiles).where(eq(profiles.id, userId)))[0]?.role;

describe('promoteToAdmin', () => {
	it('makes that one profile an admin and leaves everyone else alone', async () => {
		expect(await promoteToAdmin(test.db, id)).toBe(true);

		expect(await roleOf(id)).toBe('admin');
		expect(await roleOf(other)).toBe('member');
	});

	it('can be run again without harm', async () => {
		expect(await promoteToAdmin(test.db, id)).toBe(true);
		expect(await roleOf(id)).toBe('admin');
	});

	it('says so when there is no such profile, since the person has to log in once first', async () => {
		expect(await promoteToAdmin(test.db, '00000000-0000-4000-8000-0000000004ff')).toBe(false);
	});

	it('refuses something that is not a user id, instead of sending it to the database', async () => {
		await expect(promoteToAdmin(test.db, "x' OR '1'='1")).rejects.toThrow(/user id/i);
	});
});
