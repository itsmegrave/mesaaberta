import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, pgErrorCode } from './test-db';
import { eq, sql } from 'drizzle-orm';
import { gameTables, profiles, systems } from './schema';

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';

let test: Awaited<ReturnType<typeof createTestDb>>;
let dndId: string;
const gm = { id: '00000000-0000-4000-8000-000000000001', displayName: 'Mestre' };

const table = (overrides: Partial<typeof gameTables.$inferInsert> = {}) => ({
	slug: 'mesa-do-dragao',
	systemId: dndId,
	title: 'Mesa do Dragão',
	kind: 'one_shot' as const,
	capacity: 5,
	startsAt: new Date('2026-10-01T22:00:00Z'),
	durationMinutes: 240,
	timezone: 'America/Sao_Paulo',
	gmId: gm.id,
	...overrides
});

beforeAll(async () => {
	test = await createTestDb();
	await test.db.insert(profiles).values(gm);
	[{ id: dndId }] = await test.db
		.select({ id: systems.id })
		.from(systems)
		.where(eq(systems.slug, 'dungeons-e-dragons-5e-2014'));
});

afterAll(() => test.close());

describe('profiles', () => {
	it('start as active members', async () => {
		const [profile] = await test.db.select().from(profiles);

		expect(profile).toMatchObject({ role: 'member', status: 'active', avatarUrl: null });
	});
});

describe('game_tables', () => {
	it('start open for anyone to join, active, at ical sequence 0', async () => {
		const [created] = await test.db.insert(gameTables).values(table()).returning();

		expect(created).toMatchObject({ joinMode: 'auto', status: 'active', icalSequence: 0 });
		expect(created.id).toEqual(expect.any(String));
	});

	it('refuse a second table with the same slug', async () => {
		const code = await pgErrorCode(test.db.insert(gameTables).values(table()));

		expect(code).toBe(UNIQUE_VIOLATION);
	});

	it('refuse a table whose system does not exist', async () => {
		const code = await pgErrorCode(
			test.db
				.insert(gameTables)
				.values(table({ slug: 'sem-sistema', systemId: '00000000-0000-4000-8000-0000000000ee' }))
		);

		expect(code).toBe(FOREIGN_KEY_VIOLATION);
	});

	it('refuse a table whose GM has no profile', async () => {
		const code = await pgErrorCode(
			test.db
				.insert(gameTables)
				.values(table({ slug: 'sem-mestre', gmId: '00000000-0000-4000-8000-0000000000ff' }))
		);

		expect(code).toBe(FOREIGN_KEY_VIOLATION);
	});

	describe('recurrence', () => {
		it('is refused on a one-shot', async () => {
			const code = await pgErrorCode(
				test.db
					.insert(gameTables)
					.values(table({ slug: 'one-shot-recorrente', recurrence: 'FREQ=WEEKLY' }))
			);

			expect(code).toBe(CHECK_VIOLATION);
		});

		it('is required on a campaign', async () => {
			const code = await pgErrorCode(
				test.db.insert(gameTables).values(table({ slug: 'campanha-sem-regra', kind: 'campaign' }))
			);

			expect(code).toBe(CHECK_VIOLATION);
		});

		it('is accepted on a campaign', async () => {
			const [created] = await test.db
				.insert(gameTables)
				.values(table({ slug: 'campanha-semanal', kind: 'campaign', recurrence: 'FREQ=WEEKLY' }))
				.returning();

			expect(created.recurrence).toBe('FREQ=WEEKLY');
		});
	});

	it.each([
		['capacity', { capacity: 0 }],
		['duration', { durationMinutes: 0 }]
	])('refuse a table with a %s of zero', async (_name, overrides) => {
		const code = await pgErrorCode(
			test.db.insert(gameTables).values(table({ slug: `zero-${_name}`, ...overrides }))
		);

		expect(code).toBe(CHECK_VIOLATION);
	});
});

describe('row level security', () => {
	// Supabase serves everything in `public` over its REST API to anyone holding the publishable key,
	// which is public. Row level security with no policy is what keeps that door shut: the app itself
	// reads and writes as the database owner, which is not subject to it.
	it('is on for every table, so the Supabase REST API exposes none of them', async () => {
		const result = await test.db.execute<{ table: string; rls: boolean }>(
			sql`select c.relname as "table", c.relrowsecurity as rls
				from pg_class c join pg_namespace n on n.oid = c.relnamespace
				where n.nspname = 'public' and c.relkind = 'r'
				order by c.relname`
		);

		expect(result.rows.length).toBeGreaterThanOrEqual(6);
		expect(result.rows.filter((row) => !row.rls).map((row) => row.table)).toEqual([]);
	});
});
