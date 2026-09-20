import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gameTables, profiles, ratings, registrations, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { listPlaying, listRunning } from './queries';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000030${String(n).padStart(2, '0')}`;
const me = id(1);
const gm = id(2);
const other = id(3);
const now = new Date('2026-10-01T12:00:00Z');
let counter = 0;

beforeAll(async () => {
	test = await createTestDb();
	await test.db.insert(profiles).values([
		{ id: me, displayName: 'Eu' },
		{ id: gm, displayName: 'Mestra' },
		{ id: other, displayName: 'Outra Pessoa' },
		{ id: id(4), displayName: 'Ana' },
		{ id: id(5), displayName: 'Bruno' },
		{ id: id(6), displayName: 'Anfitriã' }
	]);
});
afterAll(() => test.close());

const makeTable = async (over: Partial<typeof gameTables.$inferInsert> = {}) => {
	const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
	const slug = `painel-${++counter}`;
	const [table] = await test.db
		.insert(gameTables)
		.values({
			slug,
			title: slug,
			kind: 'one_shot',
			capacity: 3,
			startsAt: new Date('2026-10-20T22:00:00Z'),
			durationMinutes: 120,
			timezone: 'UTC',
			gmId: gm,
			systemId: system.id,
			...over
		})
		.returning();
	return table;
};

const seat = (tableId: string, playerId: string, status: 'pending' | 'confirmed' = 'confirmed') =>
	test.db.insert(registrations).values({ tableId, playerId, status });

describe('listPlaying', () => {
	it("lists my seats and my pending requests, and nobody else's", async () => {
		const mine = await makeTable({ title: 'Minha' });
		const asking = await makeTable({ title: 'Pedi' });
		const notMine = await makeTable({ title: 'Alheia' });
		await seat(mine.id, me);
		await seat(asking.id, me, 'pending');
		await seat(notMine.id, other);

		const playing = await listPlaying(test.db, me, now);

		expect(playing.map((p) => [p.title, p.status]).sort()).toEqual([
			['Minha', 'confirmed'],
			['Pedi', 'pending']
		]);
	});

	it('gives what the card needs: system, GM, next session in its zone, and where to go', async () => {
		const table = await makeTable({ title: 'Cartão' });
		await seat(table.id, me);

		const item = (await listPlaying(test.db, me, now)).find((p) => p.title === 'Cartão');

		expect(item).toMatchObject({
			slug: table.slug,
			gmName: 'Mestra',
			timezone: 'UTC',
			nextAt: new Date('2026-10-20T22:00:00Z'),
			tableStatus: 'active'
		});
		expect(item?.systemName).toEqual(expect.any(String));
	});

	it('puts the sessions coming up first, soonest first, and finished ones last', async () => {
		const player = id(4);
		const soon = await makeTable({ title: 'Breve', startsAt: new Date('2026-10-05T20:00:00Z') });
		const later = await makeTable({ title: 'Depois', startsAt: new Date('2026-11-05T20:00:00Z') });
		const done = await makeTable({ title: 'Passada', startsAt: new Date('2026-09-01T20:00:00Z') });
		for (const t of [later, done, soon]) await seat(t.id, player);

		expect((await listPlaying(test.db, player, now)).map((p) => p.title)).toEqual([
			'Breve',
			'Depois',
			'Passada'
		]);
	});

	describe('the prompt to rate', () => {
		it('is on for a seat whose first session has ended and that has no rating yet', async () => {
			const table = await makeTable({
				title: 'Jogada',
				startsAt: new Date('2026-09-01T20:00:00Z')
			});
			await seat(table.id, me);

			const item = (await listPlaying(test.db, me, now)).find((p) => p.title === 'Jogada');

			expect(item).toMatchObject({ canRate: true, rating: null });
		});

		it('shows the rating instead once there is one, and offers to change it', async () => {
			const table = await makeTable({
				title: 'Avaliada',
				startsAt: new Date('2026-09-01T20:00:00Z')
			});
			await seat(table.id, me);
			await test.db
				.insert(ratings)
				.values({ tableId: table.id, playerId: me, tableScore: 4, gmScore: 5 });

			const item = (await listPlaying(test.db, me, now)).find((p) => p.title === 'Avaliada');

			expect(item).toMatchObject({ canRate: true, rating: { tableScore: 4, gmScore: 5 } });
		});

		it('is off before the first session ends, and for a request that is still pending', async () => {
			const future = await makeTable({ title: 'Futura' });
			const played = await makeTable({
				title: 'Só pedi',
				startsAt: new Date('2026-09-01T20:00:00Z')
			});
			await seat(future.id, me);
			await seat(played.id, me, 'pending');

			const list = await listPlaying(test.db, me, now);

			expect(list.find((p) => p.title === 'Futura')?.canRate).toBe(false);
			expect(list.find((p) => p.title === 'Só pedi')?.canRate).toBe(false);
		});
	});

	it('is empty for someone who plays nowhere', async () => {
		expect(await listPlaying(test.db, id(5), now)).toEqual([]);
	});
});

describe('listRunning', () => {
	it('lists the tables I am the GM of, and not others', async () => {
		const mine = await makeTable({ title: 'Minha mesa', gmId: me });
		await makeTable({ title: 'De outra', gmId: other });

		const running = await listRunning(test.db, me, now);

		expect(running.map((r) => r.slug)).toContain(mine.slug);
		expect(running.some((r) => r.title === 'De outra')).toBe(false);
	});

	it('includes a disabled table, marked, so the GM can still find it', async () => {
		const gmOnly = id(4);
		await makeTable({ title: 'Desativada', gmId: gmOnly, status: 'disabled' });

		expect((await listRunning(test.db, gmOnly, now))[0]).toMatchObject({
			title: 'Desativada',
			tableStatus: 'disabled'
		});
	});

	it('shows who has a seat and the queue of pending requests, separately, with names', async () => {
		const host = id(5);
		const table = await makeTable({
			title: 'Cheia',
			gmId: host,
			joinMode: 'approval',
			capacity: 3
		});
		await seat(table.id, me);
		await seat(table.id, other, 'pending');
		await seat(table.id, id(2), 'pending');

		const [item] = await listRunning(test.db, host, now);

		expect(item.players).toEqual([{ playerId: me, displayName: 'Eu' }]);
		expect(item.requests.map((r) => r.displayName).sort()).toEqual(['Mestra', 'Outra Pessoa']);
		expect(item).toMatchObject({ capacity: 3, seatsLeft: 2, joinMode: 'approval' });
	});

	it('orders by the next session, tables with none left last', async () => {
		const host = id(6);
		await makeTable({ title: 'Encerrada', gmId: host, startsAt: new Date('2026-09-01T20:00:00Z') });
		await makeTable({ title: 'Segunda', gmId: host, startsAt: new Date('2026-11-01T20:00:00Z') });
		await makeTable({ title: 'Primeira', gmId: host, startsAt: new Date('2026-10-10T20:00:00Z') });

		expect((await listRunning(test.db, host, now)).map((r) => r.title)).toEqual([
			'Primeira',
			'Segunda',
			'Encerrada'
		]);
	});

	it('is empty for someone who runs nothing', async () => {
		expect(await listRunning(test.db, id(99), now)).toEqual([]);
	});
});
