import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { events, gameTables, profiles, registrations, systems } from '../db/schema';
import { openIntegrationDb } from '../db/integration-db';
import type { Actor } from '../auth/policy';
import { approveRegistration, joinTable, leaveTable } from './service';

// Real Postgres, real concurrency: the capacity rules must hold when transactions overlap.

const { db, close } = openIntegrationDb();
const created = { profiles: [] as string[], tables: [] as string[] };

const newPlayer = async (): Promise<Actor> => {
	const id = crypto.randomUUID();
	await db.insert(profiles).values({ id, username: `jogador${id.slice(0, 6)}` });
	created.profiles.push(id);
	return { id, role: 'member', status: 'active' };
};

const newTable = async (over: Partial<typeof gameTables.$inferInsert>, gm: Actor) => {
	const [system] = await db.select({ id: systems.id }).from(systems).limit(1);
	const slug = `it-${crypto.randomUUID().slice(0, 8)}`;
	const [table] = await db
		.insert(gameTables)
		.values({
			slug,
			title: slug,
			kind: 'one_shot',
			capacity: 1,
			startsAt: new Date('2099-01-01T20:00:00Z'),
			durationMinutes: 60,
			timezone: 'UTC',
			gmId: gm.id,
			systemId: system.id,
			...over
		})
		.returning();
	created.tables.push(table.id);
	return table;
};

const confirmed = async (tableId: string) =>
	(
		await db
			.select({ n: sql<number>`count(*)::int` })
			.from(registrations)
			.where(and(eq(registrations.tableId, tableId), eq(registrations.status, 'confirmed')))
	)[0].n;

beforeAll(async () => {
	// Fail early and clearly if the migrations are missing.
	await db.select().from(systems).limit(1);
});

afterAll(async () => {
	if (created.tables.length) {
		await db.delete(registrations).where(inArray(registrations.tableId, created.tables));
		await db.delete(events).where(inArray(sql`${events.payload}->>'tableId'`, created.tables));
		await db.delete(gameTables).where(inArray(gameTables.id, created.tables));
	}
	if (created.profiles.length)
		await db.delete(profiles).where(inArray(profiles.id, created.profiles));
	await close();
});

const settle = (promises: Promise<unknown>[]) => Promise.allSettled(promises);
const outcomes = (results: PromiseSettledResult<unknown>[]) => ({
	won: results.filter((r) => r.status === 'fulfilled').length,
	full: results.filter((r) => r.status === 'rejected' && (r.reason as Error).name === 'TableFull')
		.length,
	other: results.filter((r) => r.status === 'rejected' && (r.reason as Error).name !== 'TableFull')
});

describe('joining the last seat', () => {
	it('gives it to exactly one of two players who ask at the same moment', async () => {
		const gm = await newPlayer();
		const [a, b] = [await newPlayer(), await newPlayer()];
		const table = await newTable({ capacity: 1 }, gm);

		const result = outcomes(
			await settle([joinTable(db, a, table.slug), joinTable(db, b, table.slug)])
		);

		expect(result).toMatchObject({ won: 1, full: 1, other: [] });
		expect(await confirmed(table.id)).toBe(1);
	});

	it('never seats more players than there are seats, however many pile on', async () => {
		const gm = await newPlayer();
		const players = await Promise.all(Array.from({ length: 12 }, newPlayer));
		const table = await newTable({ capacity: 5 }, gm);

		const result = outcomes(await settle(players.map((p) => joinTable(db, p, table.slug))));

		expect(result).toMatchObject({ won: 5, full: 7, other: [] });
		expect(await confirmed(table.id)).toBe(5);
	});

	it('is safe to repeat: many rounds, the count never passes the capacity', async () => {
		const gm = await newPlayer();
		const players = await Promise.all(Array.from({ length: 6 }, newPlayer));

		for (let round = 0; round < 5; round++) {
			const table = await newTable({ capacity: 2 }, gm);
			await settle(players.map((p) => joinTable(db, p, table.slug)));

			expect(await confirmed(table.id)).toBe(2);
		}
	});

	it('lets a freed seat go to a waiting player, even while others race for it', async () => {
		const gm = await newPlayer();
		const [holder, x, y] = [await newPlayer(), await newPlayer(), await newPlayer()];
		const table = await newTable({ capacity: 1 }, gm);
		await joinTable(db, holder, table.slug);

		const result = outcomes(
			await settle([
				leaveTable(db, holder, table.slug),
				joinTable(db, x, table.slug),
				joinTable(db, y, table.slug)
			])
		);

		expect(result.other).toEqual([]);
		expect(await confirmed(table.id)).toBeLessThanOrEqual(1);
	});
});

describe('approving the last seat', () => {
	it('confirms exactly one of two requests approved at the same moment', async () => {
		const gm = await newPlayer();
		const [a, b] = [await newPlayer(), await newPlayer()];
		const table = await newTable({ capacity: 1, joinMode: 'approval' }, gm);
		await joinTable(db, a, table.slug);
		await joinTable(db, b, table.slug);

		const result = outcomes(
			await settle([
				approveRegistration(db, gm, table.slug, a.id),
				approveRegistration(db, gm, table.slug, b.id)
			])
		);

		expect(result).toMatchObject({ won: 1, full: 1, other: [] });
		expect(await confirmed(table.id)).toBe(1);
	});

	it('does not let a join and an approval both take the last seat', async () => {
		const gm = await newPlayer();
		const [asker, walkIn] = [await newPlayer(), await newPlayer()];
		// Approval mode, so the walk-in only asks; approve the asker while the walk-in is asking.
		const table = await newTable({ capacity: 1, joinMode: 'approval' }, gm);
		await joinTable(db, asker, table.slug);

		await settle([
			approveRegistration(db, gm, table.slug, asker.id),
			joinTable(db, walkIn, table.slug)
		]);

		expect(await confirmed(table.id)).toBe(1);
	});

	it('leaves pending requests out of the count, so they can outnumber the seats', async () => {
		const gm = await newPlayer();
		const players = await Promise.all(Array.from({ length: 6 }, newPlayer));
		const table = await newTable({ capacity: 2, joinMode: 'approval' }, gm);

		await settle(players.map((p) => joinTable(db, p, table.slug)));

		expect(await confirmed(table.id)).toBe(0);
		const rows = await db.select().from(registrations).where(eq(registrations.tableId, table.id));
		expect(rows).toHaveLength(6);
	});
});
