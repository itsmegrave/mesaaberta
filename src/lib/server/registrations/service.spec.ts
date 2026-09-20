import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { events, gameTables, profiles, registrations, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import type { Actor } from '../auth/policy';
import {
	approveRegistration,
	declineRegistration,
	joinTable,
	leaveTable,
	listRegistrations,
	removePlayer
} from './service';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000010${String(n).padStart(2, '0')}`;
const player = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const gm = player(1);
const admin: Actor = { id: id(90), role: 'admin', status: 'active' };
let counter = 0;

beforeAll(async () => {
	test = await createTestDb();
	await test.db
		.insert(profiles)
		.values([
			...Array.from({ length: 8 }, (_, i) => ({ id: id(i + 1), displayName: `P${i + 1}` })),
			{ id: id(90), displayName: 'Admin', role: 'admin' as const }
		]);
});
afterAll(() => test.close());

/** A fresh table with `capacity` seats, so tests do not share seats. */
const makeTable = async (over: Partial<typeof gameTables.$inferInsert> = {}) => {
	const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
	const slug = `mesa-${++counter}`;
	const [table] = await test.db
		.insert(gameTables)
		.values({
			slug,
			title: slug,
			kind: 'one_shot',
			capacity: 2,
			startsAt: new Date('2099-01-01T20:00:00Z'),
			durationMinutes: 60,
			timezone: 'UTC',
			gmId: gm.id,
			systemId: system.id,
			...over
		})
		.returning();
	return table;
};

const statusOf = async (tableId: string, playerId: string) =>
	(
		await test.db
			.select()
			.from(registrations)
			.where(and(eq(registrations.tableId, tableId), eq(registrations.playerId, playerId)))
	)[0]?.status;

const eventTypes = async (eventIds: string[]) =>
	(await test.db.select().from(events))
		.filter((e) => eventIds.includes(e.id))
		.map((e) => e.type)
		.sort();

describe('joinTable on an automatic table', () => {
	it('confirms the seat at once and records PlayerJoined', async () => {
		const table = await makeTable();

		const result = await joinTable(test.db, player(2), table.slug);

		expect(result.status).toBe('confirmed');
		expect(await statusOf(table.id, id(2))).toBe('confirmed');
		expect(await eventTypes(result.eventIds)).toEqual(['PlayerJoined']);
	});

	it('fills the seats and then answers TableFull, leaving nothing behind', async () => {
		const table = await makeTable({ capacity: 2 });
		await joinTable(test.db, player(2), table.slug);
		await joinTable(test.db, player(3), table.slug);
		const eventsBefore = (await test.db.select().from(events)).length;

		await expect(joinTable(test.db, player(4), table.slug)).rejects.toMatchObject({
			name: 'TableFull'
		});

		expect(await statusOf(table.id, id(4))).toBeUndefined();
		expect((await test.db.select().from(events)).length).toBe(eventsBefore);
	});

	it('refuses a second join by the same player', async () => {
		const table = await makeTable({ capacity: 3 });
		await joinTable(test.db, player(2), table.slug);

		await expect(joinTable(test.db, player(2), table.slug)).rejects.toMatchObject({
			name: 'AlreadyRegistered'
		});
	});

	it.each([
		['the GM of the table', () => gm, 'Forbidden'],
		['an anonymous visitor', () => null, 'Forbidden'],
		['a suspended player', () => ({ ...player(5), status: 'suspended' as const }), 'Forbidden']
	])('refuses %s', async (_who, who, error) => {
		const table = await makeTable();

		await expect(joinTable(test.db, who(), table.slug)).rejects.toMatchObject({ name: error });
	});

	it('lets an admin who is not the GM take a seat', async () => {
		const table = await makeTable();

		expect((await joinTable(test.db, admin, table.slug)).status).toBe('confirmed');
	});

	it('is NotFound for a disabled table or one that does not exist', async () => {
		const off = await makeTable({ status: 'disabled' });

		await expect(joinTable(test.db, player(2), off.slug)).rejects.toMatchObject({
			name: 'NotFound'
		});
		await expect(joinTable(test.db, player(2), 'nao-existe')).rejects.toMatchObject({
			name: 'NotFound'
		});
	});
});

describe('joinTable on a table that approves each player', () => {
	it('records a pending request that takes no seat', async () => {
		const table = await makeTable({ joinMode: 'approval', capacity: 1 });

		const result = await joinTable(test.db, player(2), table.slug);

		expect(result.status).toBe('pending');
		expect(await eventTypes(result.eventIds)).toEqual(['JoinRequested']);
	});

	it('lets more players ask than there are seats, since pending requests never consume capacity', async () => {
		const table = await makeTable({ joinMode: 'approval', capacity: 1 });

		for (const n of [2, 3, 4]) await joinTable(test.db, player(n), table.slug);

		expect(await statusOf(table.id, id(2))).toBe('pending');
		expect(await statusOf(table.id, id(4))).toBe('pending');
	});

	it('does not let a pending request block someone else from a confirmed seat', async () => {
		const table = await makeTable({ joinMode: 'approval', capacity: 1 });
		await joinTable(test.db, player(2), table.slug);
		await joinTable(test.db, player(3), table.slug);

		await approveRegistration(test.db, gm, table.slug, id(2));

		expect(await statusOf(table.id, id(2))).toBe('confirmed');
		expect(await statusOf(table.id, id(3))).toBe('pending');
	});
});

describe('approveRegistration', () => {
	it('confirms the seat and records JoinApproved and PlayerJoined', async () => {
		const table = await makeTable({ joinMode: 'approval' });
		await joinTable(test.db, player(2), table.slug);

		const result = await approveRegistration(test.db, gm, table.slug, id(2));

		expect(await statusOf(table.id, id(2))).toBe('confirmed');
		expect(await eventTypes(result.eventIds)).toEqual(['JoinApproved', 'PlayerJoined']);
	});

	it('fails with TableFull when no seat is left, and leaves the request pending', async () => {
		const table = await makeTable({ joinMode: 'approval', capacity: 1 });
		await joinTable(test.db, player(2), table.slug);
		await joinTable(test.db, player(3), table.slug);
		await approveRegistration(test.db, gm, table.slug, id(2));

		await expect(approveRegistration(test.db, gm, table.slug, id(3))).rejects.toMatchObject({
			name: 'TableFull'
		});
		expect(await statusOf(table.id, id(3))).toBe('pending');
	});

	it('lets an admin approve, and refuses another member', async () => {
		const table = await makeTable({ joinMode: 'approval', capacity: 3 });
		await joinTable(test.db, player(2), table.slug);
		await joinTable(test.db, player(3), table.slug);

		await approveRegistration(test.db, admin, table.slug, id(2));
		await expect(approveRegistration(test.db, player(4), table.slug, id(3))).rejects.toMatchObject({
			name: 'Forbidden'
		});
		expect(await statusOf(table.id, id(3))).toBe('pending');
	});

	it('is NotFound when there is no pending request from that player', async () => {
		const table = await makeTable({ joinMode: 'approval' });

		await expect(approveRegistration(test.db, gm, table.slug, id(2))).rejects.toMatchObject({
			name: 'NotFound'
		});
	});
});

describe('declineRegistration', () => {
	it('deletes the request and records JoinDeclined', async () => {
		const table = await makeTable({ joinMode: 'approval' });
		await joinTable(test.db, player(2), table.slug);

		const result = await declineRegistration(test.db, gm, table.slug, id(2));

		expect(await statusOf(table.id, id(2))).toBeUndefined();
		expect(await eventTypes(result.eventIds)).toEqual(['JoinDeclined']);
	});

	it('cannot decline a player who already has a confirmed seat, and refuses another member', async () => {
		const table = await makeTable();
		await joinTable(test.db, player(2), table.slug);

		await expect(declineRegistration(test.db, gm, table.slug, id(2))).rejects.toMatchObject({
			name: 'NotFound'
		});
		await expect(declineRegistration(test.db, player(3), table.slug, id(2))).rejects.toMatchObject({
			name: 'Forbidden'
		});
	});
});

describe('leaveTable', () => {
	it('frees the seat and records PlayerLeft', async () => {
		const table = await makeTable({ capacity: 1 });
		await joinTable(test.db, player(2), table.slug);

		const result = await leaveTable(test.db, player(2), table.slug);

		expect(await statusOf(table.id, id(2))).toBeUndefined();
		expect(await eventTypes(result.eventIds)).toEqual(['PlayerLeft']);
		expect((await joinTable(test.db, player(3), table.slug)).status).toBe('confirmed');
	});

	it('withdraws a pending request without an event, since no seat was involved', async () => {
		const table = await makeTable({ joinMode: 'approval' });
		await joinTable(test.db, player(2), table.slug);

		const result = await leaveTable(test.db, player(2), table.slug);

		expect(await statusOf(table.id, id(2))).toBeUndefined();
		expect(result.eventIds).toEqual([]);
	});

	it('is NotFound when the player has no place there', async () => {
		const table = await makeTable();

		await expect(leaveTable(test.db, player(2), table.slug)).rejects.toMatchObject({
			name: 'NotFound'
		});
	});
});

describe('removePlayer', () => {
	it('deletes the registration and records PlayerLeft as removed', async () => {
		const table = await makeTable();
		await joinTable(test.db, player(2), table.slug);

		const result = await removePlayer(test.db, gm, table.slug, id(2));

		expect(await statusOf(table.id, id(2))).toBeUndefined();
		const [event] = (await test.db.select().from(events)).filter(
			(e) => e.id === result.eventIds[0]
		);
		expect(event).toMatchObject({
			type: 'PlayerLeft',
			actorId: gm.id,
			payload: { playerId: id(2), reason: 'removed' }
		});
	});

	it('lets an admin remove, and refuses another member and the player themselves', async () => {
		const table = await makeTable({ capacity: 3 });
		await joinTable(test.db, player(2), table.slug);
		await joinTable(test.db, player(3), table.slug);

		await removePlayer(test.db, admin, table.slug, id(2));
		await expect(removePlayer(test.db, player(4), table.slug, id(3))).rejects.toMatchObject({
			name: 'Forbidden'
		});
		await expect(removePlayer(test.db, player(3), table.slug, id(3))).rejects.toMatchObject({
			name: 'Forbidden'
		});
		expect(await statusOf(table.id, id(3))).toBe('confirmed');
	});
});

describe('listRegistrations', () => {
	it('gives the GM the players and the requests, with names', async () => {
		const table = await makeTable({ joinMode: 'approval', capacity: 3 });
		await joinTable(test.db, player(2), table.slug);
		await joinTable(test.db, player(3), table.slug);
		await approveRegistration(test.db, gm, table.slug, id(2));

		const list = await listRegistrations(test.db, gm, table.slug);

		expect(list).toEqual([
			{ playerId: id(2), displayName: 'P2', status: 'confirmed' },
			{ playerId: id(3), displayName: 'P3', status: 'pending' }
		]);
	});

	it('is Forbidden for anyone who is not the GM or an admin: names are not public', async () => {
		const table = await makeTable();

		await expect(listRegistrations(test.db, player(2), table.slug)).rejects.toMatchObject({
			name: 'Forbidden'
		});
	});
});
