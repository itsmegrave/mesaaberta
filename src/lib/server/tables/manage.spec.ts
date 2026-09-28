import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gameTables, profiles, systems } from '../db/schema';
import { createTestDb } from '../db/test-db';
import type { Actor } from '../auth/policy';
import {
	approveRegistration,
	declineRegistration,
	joinTable,
	removePlayer
} from '../registrations/service';
import { loadManage } from './manage';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000020${String(n).padStart(2, '0')}`;
const person = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const gm = person(1);
const [ana, bruno, carla, davi] = [person(2), person(3), person(4), person(5)];
const admin: Actor = { id: id(90), role: 'admin', status: 'active' };
const now = new Date('2026-10-01T12:00:00Z');

beforeAll(async () => {
	test = await createTestDb();
	await test.db.insert(profiles).values([
		{ id: gm.id, username: 'mestra' },
		{ id: ana.id, username: 'ana' },
		{ id: bruno.id, username: 'bruno' },
		{ id: carla.id, username: 'carla' },
		{ id: davi.id, username: 'davi' },
		{ id: admin.id, username: 'admin', role: 'admin' }
	]);
	const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
	await test.db.insert(gameTables).values({
		slug: 'mesa',
		title: 'Mesa',
		kind: 'one_shot',
		capacity: 4,
		startsAt: new Date('2099-01-01T20:00:00Z'),
		durationMinutes: 60,
		timezone: 'UTC',
		joinMode: 'approval',
		gmId: gm.id,
		systemId: system.id
	});

	// Ana and Bruno ask; Ana is approved. Carla asks and is declined. Davi asks, is approved, then removed.
	for (const player of [ana, bruno, carla, davi]) await joinTable(test.db, player, 'mesa');
	await approveRegistration(test.db, gm, 'mesa', ana.id);
	await declineRegistration(test.db, gm, 'mesa', carla.id);
	await approveRegistration(test.db, gm, 'mesa', davi.id);
	await removePlayer(test.db, gm, 'mesa', davi.id);
});
afterAll(() => test.close());

describe('loadManage', () => {
	it('splits the requests waiting from the players seated, with the day each got a seat', async () => {
		const manage = await loadManage(test.db, gm, 'mesa', now);

		expect(manage.requests.map((r) => r.username)).toEqual(['bruno']);
		expect(manage.players.map((p) => p.username)).toEqual(['ana']);
		expect(manage.players[0].since).toBeInstanceOf(Date);
		expect(manage.gm.username).toBe('mestra');
		expect(manage.table.seatsLeft).toBe(3);
	});

	it('shows the latest activity first, naming the player and telling a removal from leaving', async () => {
		const { activity } = await loadManage(test.db, gm, 'mesa', now);

		expect(activity[0]).toMatchObject({ type: 'PlayerLeft', player: 'davi', removed: true });
		expect(activity.map((a) => a.type)).toContain('JoinDeclined');
		expect(activity.length).toBeLessThanOrEqual(8);
	});

	it('opens for the GM and an admin only', async () => {
		await expect(loadManage(test.db, admin, 'mesa', now)).resolves.toBeTruthy();
		await expect(loadManage(test.db, ana, 'mesa', now)).rejects.toMatchObject({
			name: 'Forbidden'
		});
		await expect(loadManage(test.db, null, 'mesa', now)).rejects.toMatchObject({
			name: 'Forbidden'
		});
		await expect(loadManage(test.db, gm, 'nao-existe', now)).rejects.toMatchObject({
			name: 'NotFound'
		});
	});
});
