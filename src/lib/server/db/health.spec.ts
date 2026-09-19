import { afterAll, describe, expect, it } from 'vitest';
import { checkDatabase } from './health';
import { createTestDb } from './test-db';

describe('checkDatabase', () => {
	it('says the database is not configured when there is none', async () => {
		expect(await checkDatabase(null)).toBe('not_configured');
	});

	it('says ok when the database answers', async () => {
		const test = await createTestDb();
		afterAll(() => test.close());

		expect(await checkDatabase(test.db)).toBe('ok');
	});

	it('says down when the database cannot be reached, instead of throwing', async () => {
		const test = await createTestDb();
		await test.close();

		expect(await checkDatabase(test.db)).toBe('down');
	});
});
