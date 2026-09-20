import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, gameTables, profiles, ratings, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import type { Actor } from '../auth/policy';
import { joinTable, leaveTable, removePlayer } from '../registrations/service';
import { firstSessionEnded, gmRating, ratingOf, submitRating, tableRating } from './service';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000020${String(n).padStart(2, '0')}`;
const player = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const gm = player(1);
const admin: Actor = { id: id(90), role: 'admin', status: 'active' };
const past = new Date('2026-01-01T20:00:00Z');
const after = new Date('2026-06-01T00:00:00Z'); // long after the first session
const before = new Date('2025-12-01T00:00:00Z');
let counter = 0;

beforeAll(async () => {
	test = await createTestDb();
	await test.db
		.insert(profiles)
		.values([
			...Array.from({ length: 6 }, (_, i) => ({ id: id(i + 1), displayName: `P${i + 1}` })),
			{ id: id(90), displayName: 'Admin', role: 'admin' as const }
		]);
});
afterAll(() => test.close());

const makeTable = async (over: Partial<typeof gameTables.$inferInsert> = {}) => {
	const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
	const slug = `nota-${++counter}`;
	const [table] = await test.db
		.insert(gameTables)
		.values({
			slug,
			title: slug,
			kind: 'one_shot',
			capacity: 5,
			startsAt: past,
			durationMinutes: 240,
			timezone: 'UTC',
			gmId: gm.id,
			systemId: system.id,
			...over
		})
		.returning();
	return table;
};

const input = (over: Partial<Parameters<typeof submitRating>[3]> = {}) => ({
	tableScore: 5,
	gmScore: 4,
	comment: null,
	...over
});

const seated = async (n: number, slug: string) => joinTable(test.db, player(n), slug);

describe('firstSessionEnded', () => {
	const table = { startsAt: past, durationMinutes: 240 };

	it('is false until the first session is over, and true from the moment it ends', () => {
		expect(firstSessionEnded(table, new Date('2026-01-01T23:59:59Z'))).toBe(false);
		expect(firstSessionEnded(table, new Date('2026-01-02T00:00:00Z'))).toBe(true);
	});

	it('is about the first session only: a campaign that still has sessions ahead can be rated', () => {
		expect(
			firstSessionEnded({ startsAt: past, durationMinutes: 60 }, new Date('2026-01-10T00:00:00Z'))
		).toBe(true);
	});
});

describe('submitRating', () => {
	it('stores both scores and the comment, and records RatingSubmitted', async () => {
		const table = await makeTable();
		await seated(2, table.slug);

		const { eventIds } = await submitRating(
			test.db,
			player(2),
			table.slug,
			input({ comment: 'Ótima.' }),
			after
		);

		expect(await ratingOf(test.db, table.id, id(2))).toMatchObject({
			tableScore: 5,
			gmScore: 4,
			comment: 'Ótima.'
		});
		const [event] = (await test.db.select().from(events)).filter((e) => e.id === eventIds[0]);
		expect(event).toMatchObject({
			type: 'RatingSubmitted',
			actorId: id(2),
			payload: { slug: table.slug, playerId: id(2) }
		});
		expect(JSON.stringify(event.payload)).not.toContain('Ótima');
	});

	it('can be edited later: one rating per player, and the latest wins', async () => {
		const table = await makeTable();
		await seated(2, table.slug);

		await submitRating(test.db, player(2), table.slug, input({ tableScore: 2, gmScore: 2 }), after);
		await submitRating(
			test.db,
			player(2),
			table.slug,
			input({ tableScore: 5, gmScore: 5, comment: 'Melhorou.' }),
			after
		);

		const rows = await test.db.select().from(ratings).where(eq(ratings.tableId, table.id));
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ tableScore: 5, gmScore: 5, comment: 'Melhorou.' });
	});

	it('refuses a rating before the first session has ended, with TooEarly', async () => {
		const table = await makeTable();
		await seated(2, table.slug);

		await expect(
			submitRating(test.db, player(2), table.slug, input(), before)
		).rejects.toMatchObject({
			name: 'TooEarly'
		});
		expect(await ratingOf(test.db, table.id, id(2))).toBeNull();
	});

	it.each([
		['the GM of the table', () => gm],
		['an admin who never had a seat', () => admin],
		['an anonymous visitor', () => null],
		['someone who has no seat', () => player(5)]
	])('refuses %s', async (_who, who) => {
		const table = await makeTable();
		await seated(2, table.slug);

		await expect(submitRating(test.db, who(), table.slug, input(), after)).rejects.toMatchObject({
			name: 'Forbidden'
		});
	});

	it('refuses a player whose request is still pending, since they did not play', async () => {
		const table = await makeTable({ joinMode: 'approval' });
		await seated(2, table.slug); // pending

		await expect(
			submitRating(test.db, player(2), table.slug, input(), after)
		).rejects.toMatchObject({
			name: 'Forbidden'
		});
	});

	it('is NotFound for a table that does not exist', async () => {
		await expect(
			submitRating(test.db, player(2), 'nao-existe', input(), after)
		).rejects.toMatchObject({
			name: 'NotFound'
		});
	});
});

describe('when a player goes, their rating goes with them', () => {
	it('is deleted when the GM removes the player', async () => {
		const table = await makeTable();
		await seated(2, table.slug);
		await submitRating(test.db, player(2), table.slug, input(), after);

		await removePlayer(test.db, gm, table.slug, id(2));

		expect(await ratingOf(test.db, table.id, id(2))).toBeNull();
	});

	it('is deleted when the player leaves', async () => {
		const table = await makeTable();
		await seated(2, table.slug);
		await submitRating(test.db, player(2), table.slug, input(), after);

		await leaveTable(test.db, player(2), table.slug);

		expect(await test.db.select().from(ratings).where(eq(ratings.tableId, table.id))).toHaveLength(
			0
		);
	});
});

describe('averages, computed by a query', () => {
	it("gives a table's average and how many rated it", async () => {
		const table = await makeTable();
		for (const [n, score] of [
			[2, 5],
			[3, 4],
			[4, 3]
		] as const) {
			await seated(n, table.slug);
			await submitRating(
				test.db,
				player(n),
				table.slug,
				input({ tableScore: score, gmScore: 1 }),
				after
			);
		}

		expect(await tableRating(test.db, table.id)).toEqual({ average: 4, count: 3 });
	});

	it("gives a GM's average across all their tables, not a table's", async () => {
		const otherGm = player(6);
		const a = await makeTable({ gmId: otherGm.id });
		const b = await makeTable({ gmId: otherGm.id });
		await seated(2, a.slug);
		await seated(3, b.slug);
		await submitRating(test.db, player(2), a.slug, input({ tableScore: 1, gmScore: 5 }), after);
		await submitRating(test.db, player(3), b.slug, input({ tableScore: 1, gmScore: 4 }), after);

		expect(await gmRating(test.db, otherGm.id)).toEqual({ average: 4.5, count: 2 });
	});

	it('is null, with a count of zero, when nobody has rated', async () => {
		const table = await makeTable({ gmId: id(5) });

		expect(await tableRating(test.db, table.id)).toEqual({ average: null, count: 0 });
		expect(await gmRating(test.db, id(5))).toEqual({ average: null, count: 0 });
	});

	it("follows the data: a removed player's rating stops counting", async () => {
		const table = await makeTable({ gmId: id(4) });
		await seated(2, table.slug);
		await seated(3, table.slug);
		await submitRating(test.db, player(2), table.slug, input({ gmScore: 1 }), after);
		await submitRating(test.db, player(3), table.slug, input({ gmScore: 5 }), after);
		expect((await gmRating(test.db, id(4))).average).toBe(3);

		await removePlayer(test.db, { id: id(4), role: 'member', status: 'active' }, table.slug, id(2));

		expect(await gmRating(test.db, id(4))).toEqual({ average: 5, count: 1 });
	});
});
