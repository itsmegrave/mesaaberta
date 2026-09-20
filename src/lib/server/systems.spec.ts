import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from './db/test-db';
import { findSystemBySlug, listSystems } from './systems';

let test: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => (test = await createTestDb()));
afterAll(() => test.close());

describe('the seeded RPG systems', () => {
	it('has all 682 of them, each once', async () => {
		const all = await listSystems(test.db);

		expect(all).toHaveLength(682);
		expect(new Set(all.map((system) => system.name)).size).toBe(682);
		expect(new Set(all.map((system) => system.slug)).size).toBe(682);
	});

	it('keeps the names exactly as written, accents, symbols and case included', async () => {
		const names = new Set((await listSystems(test.db)).map((system) => system.name));

		for (const name of [
			'Dungeons & Dragons 5.5e (2024)',
			'Tormenta 20 (T20)',
			':Otherscape',
			'+2d6',
			"Assassin's Creed RPG",
			'Áureos: Os Dançarinos da Lua',
			'Mörk Borg',
			'The Lord of the Rings™ Roleplaying 5e',
			'Psi*Run',
			'tremulus',
			'Outro'
		]) {
			expect(names).toContain(name);
		}
	});

	it('gives every system a URL-safe slug', async () => {
		for (const { name, slug } of await listSystems(test.db)) {
			expect(slug, name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
			expect(slug.length, name).toBeLessThanOrEqual(60);
		}
	});

	it.each([
		['Dungeons & Dragons 5e (2014)', 'dungeons-e-dragons-5e-2014'],
		['Tormenta 20 (T20)', 'tormenta-20-t20'],
		['3D&T', '3dt'],
		['Mörk Borg', 'mork-borg'],
		['+2d6', '2d6'],
		[':Otherscape', 'otherscape'],
		['Outro', 'outro']
	])('slugs %j as %j', async (name, slug) => {
		const all = await listSystems(test.db);

		expect(all.find((system) => system.name === name)?.slug).toBe(slug);
	});

	it('gives two names that differ only in case different slugs, so neither is lost', async () => {
		const all = await listSystems(test.db);
		const slugOf = (name: string) => all.find((system) => system.name === name)?.slug;

		expect(slugOf('Cy_borg')).toBe('cy-borg');
		expect(slugOf('CY_BORG')).toBe('cy-borg-2');
	});

	it('lists the most played systems first, then A to Z, as in the source list', async () => {
		const all = await listSystems(test.db);

		expect(all.slice(0, 5).map((system) => system.name)).toEqual([
			'Dungeons & Dragons 5.5e (2024)',
			'Dungeons & Dragons 5e (2014)',
			'Tormenta 20 (T20)',
			'Daggerheart',
			'Chamado de Cthulhu'
		]);
		expect(all.at(-1)?.name).toBe('Zweihander');
	});
});

describe('findSystemBySlug', () => {
	it('finds a system by the slug in its URL', async () => {
		expect(await findSystemBySlug(test.db, 'daggerheart')).toMatchObject({ name: 'Daggerheart' });
	});

	it('is null for a slug that does not exist, so the page can answer 404', async () => {
		expect(await findSystemBySlug(test.db, 'nao-existe')).toBeNull();
	});
});

describe('the migrations, applied to a database that already has tables', () => {
	// The Worker may already hold tables with a free-text system when this ships.
	const statements = (file: string) =>
		readFileSync(`drizzle/${file}`, 'utf8')
			.split('--> statement-breakpoint')
			.map((sql) => sql.trim())
			.filter(Boolean);

	const applyOld = async () => {
		const client = new PGlite();
		for (const sql of statements('0000_initial.sql')) await client.exec(sql);

		const gm = '00000000-0000-4000-8000-000000000501';
		await client.exec(`INSERT INTO profiles (id, display_name) VALUES ('${gm}', 'GM')`);
		for (const [slug, system] of [
			['a', 'Daggerheart'],
			['b', 'Um sistema que ninguém listou']
		]) {
			await client.exec(`INSERT INTO game_tables
				(slug, system, title, kind, capacity, starts_at, duration_minutes, timezone, gm_id)
				VALUES ('${slug}', '${system}', 't', 'one_shot', 4, now(), 60, 'UTC', '${gm}')`);
		}

		return client;
	};

	it('points an existing table at the system with that name, and at "Outro" when there is none', async () => {
		const client = await applyOld();
		for (const file of ['0001_rpg_systems.sql', '0002_drop_table_system_text.sql']) {
			for (const sql of statements(file)) await client.exec(sql);
		}

		const { rows } = await client.query<{ slug: string; system: string }>(
			`SELECT t.slug, s.name AS system FROM game_tables t JOIN systems s ON s.id = t.system_id ORDER BY t.slug`
		);

		expect(rows).toEqual([
			{ slug: 'a', system: 'Daggerheart' },
			{ slug: 'b', system: 'Outro' }
		]);
		await client.close();
	});

	it('drops the old free-text column', async () => {
		const client = await applyOld();
		for (const file of ['0001_rpg_systems.sql', '0002_drop_table_system_text.sql']) {
			for (const sql of statements(file)) await client.exec(sql);
		}

		const { rows } = await client.query(
			`SELECT column_name FROM information_schema.columns WHERE table_name = 'game_tables' AND column_name = 'system'`
		);

		expect(rows).toHaveLength(0);
		await client.close();
	});
});
