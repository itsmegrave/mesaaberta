import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, gameTables, profiles } from '../db/schema';
import { createTestDb } from '../db/test-db';
import { findTableBySlug, listUpcomingTables } from './queries';
import { createTable, disableTable, loadTableForEdit, updateTable } from './write';
import type { TableInput } from '$lib/tables/schema';
import type { Actor } from '../auth/policy';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-01T12:00:00Z');

const id = (n: number) => `00000000-0000-4000-8000-0000000007${String(n).padStart(2, '0')}`;
const member = (n: number): Actor => ({ id: id(n), role: 'member', status: 'active' });
const admin: Actor = { id: id(99), role: 'admin', status: 'active' };
const ana = member(1);
const bruno = member(2);

const input = (over: Partial<TableInput> = {}): TableInput => ({
	systemSlug: 'daggerheart',
	title: 'Mesa do Dragão',
	description: 'Uma noite só.',
	extraInfo: null,
	kind: 'one_shot',
	capacity: 5,
	startsAtLocal: '2026-10-10T19:00',
	timezone: 'America/Sao_Paulo',
	durationMinutes: 240,
	recurrence: null,
	untilLocalDate: null,
	joinMode: 'auto',
	...over
});

beforeAll(async () => {
	test = await createTestDb();
	await test.db.insert(profiles).values([
		{ id: id(1), displayName: 'Ana' },
		{ id: id(2), displayName: 'Bruno' },
		{ id: id(99), displayName: 'Admin', role: 'admin' }
	]);
});
afterAll(() => test.close());

const rowOf = async (slug: string) =>
	(await test.db.select().from(gameTables).where(eq(gameTables.slug, slug)))[0];

describe('createTable', () => {
	it('creates a table the creator is the GM of, live at a slug made from its title', async () => {
		const { slug } = await createTable(test.db, ana, input(), { now });

		expect(slug).toBe('mesa-do-dragao');
		expect(await rowOf(slug)).toMatchObject({ gmId: ana.id, status: 'active', icalSequence: 0 });
		expect(await findTableBySlug(test.db, slug, now)).toMatchObject({ title: 'Mesa do Dragão' });
	});

	it("stores the start as the instant of that wall-clock time in the table's timezone", async () => {
		const { slug } = await createTable(test.db, ana, input({ title: 'Horário' }), { now });

		// 19:00 in São Paulo (UTC-3)
		expect((await rowOf(slug)).startsAt).toEqual(new Date('2026-10-10T22:00:00Z'));
	});

	it('turns a weekly campaign and its last day into a rule and an end instant', async () => {
		const { slug } = await createTable(
			test.db,
			ana,
			input({
				title: 'Campanha',
				kind: 'campaign',
				recurrence: 'FREQ=WEEKLY',
				untilLocalDate: '2026-12-01'
			}),
			{ now }
		);

		expect(await rowOf(slug)).toMatchObject({
			kind: 'campaign',
			recurrence: 'FREQ=WEEKLY',
			until: new Date('2026-12-02T02:59:00Z')
		});
	});

	it('gives two tables with the same title different slugs', async () => {
		const first = await createTable(test.db, ana, input({ title: 'Repetida' }), { now });
		const second = await createTable(test.db, bruno, input({ title: 'Repetida' }), { now });
		const third = await createTable(test.db, bruno, input({ title: 'Repetida' }), { now });

		expect([first.slug, second.slug, third.slug]).toEqual(['repetida', 'repetida-2', 'repetida-3']);
	});

	it('lets two simultaneous creates both win, with different slugs, instead of one failing', async () => {
		const results = await Promise.all([
			createTable(test.db, ana, input({ title: 'Corrida' }), { now }),
			createTable(test.db, bruno, input({ title: 'Corrida' }), { now })
		]);

		expect(new Set(results.map((r) => r.slug)).size).toBe(2);
		expect(results.map((r) => r.slug).sort()).toEqual(['corrida', 'corrida-2']);
	});

	it('stores the path of an uploaded image', async () => {
		const { slug } = await createTable(test.db, ana, input({ title: 'Com imagem' }), {
			now,
			imagePath: 'tables/abc.png'
		});

		expect((await rowOf(slug)).imagePath).toBe('tables/abc.png');
	});

	it('never uses a slug a static route owns', async () => {
		const { slug } = await createTable(test.db, ana, input({ title: 'New' }), { now });

		expect(slug).toBe('new-2');
	});

	it('refuses an anonymous visitor and a suspended account', async () => {
		await expect(createTable(test.db, null, input(), { now })).rejects.toMatchObject({
			name: 'Forbidden'
		});
		await expect(
			createTable(test.db, { ...ana, status: 'suspended' }, input(), { now })
		).rejects.toMatchObject({ name: 'Forbidden' });
	});

	it('refuses a system that does not exist, saying which field is wrong', async () => {
		await expect(
			createTable(test.db, ana, input({ systemSlug: 'nao-existe' }), { now })
		).rejects.toMatchObject({ name: 'Invalid', field: 'systemSlug' });
	});

	it('refuses a first session in the past', async () => {
		await expect(
			createTable(test.db, ana, input({ startsAtLocal: '2026-09-01T19:00' }), { now })
		).rejects.toMatchObject({ name: 'Invalid', field: 'startsAtLocal' });
	});
});

describe('loadTableForEdit', () => {
	it('gives the GM their table in the shape of the form, even when it is disabled', async () => {
		const { slug } = await createTable(test.db, ana, input({ title: 'Para editar' }), { now });
		await disableTable(test.db, ana, slug);

		expect(await loadTableForEdit(test.db, ana, slug)).toMatchObject({
			title: 'Para editar',
			systemSlug: 'daggerheart',
			startsAtLocal: '2026-10-10T19:00',
			timezone: 'America/Sao_Paulo',
			kind: 'one_shot',
			status: 'disabled'
		});
	});

	it('is Forbidden for another member and NotFound for a slug that does not exist', async () => {
		const { slug } = await createTable(test.db, ana, input({ title: 'Da Ana' }), { now });

		await expect(loadTableForEdit(test.db, bruno, slug)).rejects.toMatchObject({
			name: 'Forbidden'
		});
		await expect(loadTableForEdit(test.db, ana, 'nao-existe')).rejects.toMatchObject({
			name: 'NotFound'
		});
	});
});

describe('updateTable', () => {
	it('changes the fields, but renaming keeps the URL', async () => {
		const { slug } = await createTable(test.db, ana, input({ title: 'Nome Antigo' }), { now });

		await updateTable(
			test.db,
			ana,
			slug,
			input({ title: 'Nome Novo', capacity: 4, description: 'Nova.' })
		);

		expect(await rowOf(slug)).toMatchObject({ title: 'Nome Novo', capacity: 4, slug });
		expect(await rowOf('nome-novo')).toBeUndefined();
	});

	it('bumps the calendar sequence on every edit, so invites replace the old event', async () => {
		const { slug } = await createTable(test.db, ana, input({ title: 'Sequência' }), { now });

		await updateTable(test.db, ana, slug, input({ title: 'Sequência', capacity: 6 }));
		await updateTable(test.db, ana, slug, input({ title: 'Sequência', capacity: 7 }));

		expect((await rowOf(slug)).icalSequence).toBe(2);
	});

	it('keeps the current image unless a new one is given', async () => {
		const { slug } = await createTable(test.db, ana, input({ title: 'Imagem' }), {
			now,
			imagePath: 'tables/old.png'
		});

		await updateTable(test.db, ana, slug, input({ title: 'Imagem' }));
		expect((await rowOf(slug)).imagePath).toBe('tables/old.png');

		await updateTable(test.db, ana, slug, input({ title: 'Imagem' }), {
			imagePath: 'tables/new.png'
		});
		expect((await rowOf(slug)).imagePath).toBe('tables/new.png');
	});

	it('does not change who the GM is', async () => {
		const { slug } = await createTable(test.db, ana, input({ title: 'Dona' }), { now });

		await updateTable(test.db, admin, slug, input({ title: 'Dona' }));

		expect((await rowOf(slug)).gmId).toBe(ana.id);
	});

	it('lets the GM and an admin edit, and refuses another member', async () => {
		const { slug } = await createTable(test.db, ana, input({ title: 'Permissões' }), { now });

		await updateTable(test.db, ana, slug, input({ title: 'Permissões', capacity: 2 }));
		await updateTable(test.db, admin, slug, input({ title: 'Permissões', capacity: 3 }));
		await expect(
			updateTable(test.db, bruno, slug, input({ title: 'Permissões', capacity: 9 }))
		).rejects.toMatchObject({ name: 'Forbidden' });

		expect((await rowOf(slug)).capacity).toBe(3);
	});

	it('is NotFound for a slug that does not exist', async () => {
		await expect(updateTable(test.db, ana, 'nao-existe', input())).rejects.toMatchObject({
			name: 'NotFound'
		});
	});
});

describe('disableTable', () => {
	it('takes the table off the public list and pages', async () => {
		const { slug } = await createTable(test.db, ana, input({ title: 'Some' }), { now });
		expect((await listUpcomingTables(test.db, now)).map((t) => t.slug)).toContain(slug);

		await disableTable(test.db, ana, slug);

		expect((await listUpcomingTables(test.db, now)).map((t) => t.slug)).not.toContain(slug);
		expect(await findTableBySlug(test.db, slug, now)).toBeNull();
	});

	it('lets an admin disable, and refuses another member', async () => {
		const { slug } = await createTable(test.db, ana, input({ title: 'Moderada' }), { now });

		await expect(disableTable(test.db, bruno, slug)).rejects.toMatchObject({ name: 'Forbidden' });
		expect((await rowOf(slug)).status).toBe('active');

		await disableTable(test.db, admin, slug);
		expect((await rowOf(slug)).status).toBe('disabled');
	});
});

describe('events', () => {
	const eventsOf = async (type: string) =>
		(await test.db.select().from(events).where(eq(events.type, type))).filter((e) =>
			(e.payload as { slug: string }).slug.startsWith('evt-')
		);

	it('create records TableCreated with the actor and the table, and returns its id', async () => {
		const { slug, eventId } = await createTable(test.db, ana, input({ title: 'Evt Criada' }), {
			now
		});

		const [event] = await eventsOf('TableCreated');
		expect(event).toMatchObject({
			id: eventId,
			actorId: ana.id,
			processedAt: null,
			payload: { slug, title: 'Evt Criada', tableId: expect.any(String) }
		});
		expect((event.payload as { tableId: string }).tableId).toBe((await rowOf(slug)).id);
	});

	it('edit and disable each record their own event', async () => {
		const { slug } = await createTable(test.db, ana, input({ title: 'Evt Ciclo' }), { now });

		const edited = await updateTable(test.db, admin, slug, input({ title: 'Evt Ciclo Novo' }));
		const disabled = await disableTable(test.db, ana, slug);

		const updated = (await eventsOf('TableUpdated')).find((e) => e.id === edited.eventId);
		const off = (await eventsOf('TableDisabled')).find((e) => e.id === disabled.eventId);
		expect(updated).toMatchObject({
			actorId: admin.id,
			payload: { slug, title: 'Evt Ciclo Novo' }
		});
		expect(off).toMatchObject({ actorId: ana.id, payload: { slug } });
	});

	it('records nothing when the action is refused', async () => {
		const { slug } = await createTable(test.db, ana, input({ title: 'Evt Recusada' }), { now });
		const before = (await test.db.select().from(events)).length;

		await expect(updateTable(test.db, bruno, slug, input())).rejects.toMatchObject({
			name: 'Forbidden'
		});
		await expect(disableTable(test.db, bruno, slug)).rejects.toMatchObject({ name: 'Forbidden' });
		await expect(createTable(test.db, null, input(), { now })).rejects.toMatchObject({
			name: 'Forbidden'
		});

		expect((await test.db.select().from(events)).length).toBe(before);
	});

	it('records one event per table even when two creates race for a slug', async () => {
		const before = (await test.db.select().from(events)).length;

		await Promise.all([
			createTable(test.db, ana, input({ title: 'Evt Corrida' }), { now }),
			createTable(test.db, bruno, input({ title: 'Evt Corrida' }), { now })
		]);

		expect((await test.db.select().from(events)).length - before).toBe(2);
	});
});
