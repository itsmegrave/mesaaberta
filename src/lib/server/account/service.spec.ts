import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
	events,
	gameTables,
	profileSocialLinks,
	profiles,
	ratings,
	registrations,
	systems
} from '../db/schema';
import { createTestDb } from '../db/test-db';
import { anonymiseProfile, closeAccount, exportAccount } from './service';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000007${String(n).padStart(2, '0')}`;
const me = id(1);
const other = id(2);
let counter = 0;

beforeAll(async () => {
	test = await createTestDb();
	await test.db.insert(profiles).values([
		{ id: me, username: 'ana', name: 'Ana Souza', age: 30, city: 'Recife' },
		{ id: other, username: 'bruno' }
	]);
	await test.db
		.insert(profileSocialLinks)
		.values({ profileId: me, network: 'github', url: 'https://github.com/ana', position: 0 });
});
afterAll(() => test.close());

const makeTable = async (gmId: string, over: Partial<typeof gameTables.$inferInsert> = {}) => {
	const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
	const slug = `conta-${++counter}`;
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
			gmId,
			systemId: system.id,
			...over
		})
		.returning();
	return table;
};

describe('exportAccount', () => {
	it('gathers everything the account holds, with the email, and nothing about other people', async () => {
		const mine = await makeTable(me, { title: 'Minha mesa' });
		const theirs = await makeTable(other, { title: 'Mesa do Bruno' });
		await test.db.insert(registrations).values([
			{ tableId: theirs.id, playerId: me, status: 'confirmed' },
			{ tableId: mine.id, playerId: other, status: 'confirmed' }
		]);
		await test.db
			.insert(ratings)
			.values({ tableId: theirs.id, playerId: me, tableScore: 4, gmScore: 5, comment: 'Ótima' });

		const data = await exportAccount(
			test.db,
			me,
			'ana@example.com',
			new Date('2026-09-27T12:00:00Z')
		);

		expect(data.exportedAt).toBe('2026-09-27T12:00:00.000Z');
		expect(data.account).toEqual({ id: me, email: 'ana@example.com' });
		expect(data.profile).toMatchObject({
			username: 'ana',
			name: 'Ana Souza',
			age: 30,
			city: 'Recife'
		});
		expect(data.socialLinks).toEqual([{ network: 'github', url: 'https://github.com/ana' }]);
		expect(data.tablesAsGm.map((t) => t.title)).toContain('Minha mesa');
		expect(data.seats).toEqual([
			expect.objectContaining({ table: 'Mesa do Bruno', status: 'confirmed' })
		]);
		expect(data.ratingsGiven).toEqual([
			expect.objectContaining({
				table: 'Mesa do Bruno',
				tableScore: 4,
				gmScore: 5,
				comment: 'Ótima'
			})
		]);
		// The players at my tables are other people's data.
		expect(JSON.stringify(data)).not.toContain(other);
	});
});

describe('closeAccount', () => {
	it("disables the person's active tables with an event each, and removes their seats and ratings", async () => {
		const gm = id(10);
		await test.db.insert(profiles).values({ id: gm, username: 'carla' });
		const active = await makeTable(gm);
		const gone = await makeTable(gm, { status: 'disabled' });
		const elsewhere = await makeTable(other);
		await test.db.insert(registrations).values([
			{ tableId: elsewhere.id, playerId: gm, status: 'confirmed' },
			{ tableId: active.id, playerId: other, status: 'confirmed' }
		]);
		await test.db
			.insert(ratings)
			.values({ tableId: elsewhere.id, playerId: gm, tableScore: 3, gmScore: 3 });

		const { eventIds } = await closeAccount(test.db, gm);

		const [a] = await test.db.select().from(gameTables).where(eq(gameTables.id, active.id));
		expect(a.status).toBe('disabled');
		expect(a.icalSequence).toBe(active.icalSequence + 1);
		const [g] = await test.db.select().from(gameTables).where(eq(gameTables.id, gone.id));
		expect(g.icalSequence).toBe(gone.icalSequence);

		expect(eventIds).toHaveLength(1);
		const [event] = await test.db.select().from(events).where(eq(events.id, eventIds[0]));
		expect(event).toMatchObject({ type: 'TableDisabled', actorId: gm });

		expect(
			await test.db.select().from(registrations).where(eq(registrations.playerId, gm))
		).toEqual([]);
		expect(await test.db.select().from(ratings).where(eq(ratings.playerId, gm))).toEqual([]);
		// The other players keep their own seat record at the (now disabled) table.
		expect(
			await test.db.select().from(registrations).where(eq(registrations.tableId, active.id))
		).toHaveLength(1);
	});
});

describe('anonymiseProfile', () => {
	it('clears every personal field and the links, keeping only the id the old tables point at', async () => {
		const person = id(20);
		await test.db.insert(profiles).values({
			id: person,
			username: 'davi',
			name: 'Davi',
			age: 40,
			gender: 'homem',
			city: 'Natal',
			avatarUrl: 'https://example.com/a.png'
		});
		await test.db
			.insert(profileSocialLinks)
			.values({ profileId: person, network: 'x', url: 'https://x.com/davi', position: 0 });

		await anonymiseProfile(test.db, person);

		const [profile] = await test.db.select().from(profiles).where(eq(profiles.id, person));
		expect(profile).toMatchObject({
			username: null,
			name: null,
			age: null,
			gender: null,
			city: null,
			avatarUrl: null,
			status: 'suspended'
		});
		expect(
			await test.db
				.select()
				.from(profileSocialLinks)
				.where(eq(profileSocialLinks.profileId, person))
		).toEqual([]);
	});
});
