import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Migrations that change existing rows are tested the way they will run: with rows already there.
// The schema is built up to the migration before, the rows are inserted the way the old code wrote
// them, and only then does the migration under test run.

const folder = join(process.cwd(), 'drizzle');
const journal: { entries: { tag: string }[] } = JSON.parse(
	readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')
);

async function applyMigrations(client: PGlite, { through }: { through: string }) {
	const last = journal.entries.findIndex((entry) => entry.tag === through);
	if (last === -1) throw new Error(`no migration named ${through}`);

	for (const { tag } of journal.entries.slice(0, last + 1)) {
		const sql = readFileSync(join(folder, `${tag}.sql`), 'utf8');
		for (const statement of sql.split('--> statement-breakpoint')) await client.exec(statement);
	}
}

async function applyMigration(client: PGlite, tag: string) {
	const sql = readFileSync(join(folder, `${tag}.sql`), 'utf8');
	for (const statement of sql.split('--> statement-breakpoint')) await client.exec(statement);
}

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('0007_public_profiles', () => {
	const legacyNames: [number, string, string][] = [
		[1, 'Ana Maria', '2026-01-01T00:00:00Z'],
		[2, 'João da Silva', '2026-01-02T00:00:00Z'],
		// The same name again: the later profile gets a numeric suffix.
		[3, 'Ana Maria', '2026-01-03T00:00:00Z'],
		// Takes `ana-maria-2` by its own name, after the suffix already went to the duplicate.
		[4, 'ana-maria-2', '2026-01-04T00:00:00Z'],
		// Nothing usable, the placeholder, reserved and too short: they pick one in the onboarding.
		[5, 'Jogador', '2026-01-05T00:00:00Z'],
		[6, '🎲🎲', '2026-01-06T00:00:00Z'],
		[7, 'Admin', '2026-01-07T00:00:00Z'],
		[8, 'Zé', '2026-01-08T00:00:00Z'],
		[9, 'Mestre   do   Dragão --- das Trevas Eternas e Profundas', '2026-01-09T00:00:00Z'],
		[10, 'Caça-Níqueis & Cia', '2026-01-10T00:00:00Z']
	];

	let client: PGlite;

	beforeAll(async () => {
		client = new PGlite();
		await applyMigrations(client, { through: '0006_enable_rls' });
		for (const [n, name, createdAt] of legacyNames) {
			await client.query(
				`insert into profiles (id, display_name, created_at) values ($1, $2, $3)`,
				[uuid(n), name, createdAt]
			);
		}
		await applyMigration(client, '0007_public_profiles');
	});

	afterAll(() => client.close());

	const usernames = async () =>
		Object.fromEntries(
			(
				await client.query<{ id: string; username: string | null }>(
					`select id, username from profiles order by created_at`
				)
			).rows.map((row) => [Number(row.id.slice(-12)), row.username])
		);

	it('keeps every existing profile and gives each a username made from its display name', async () => {
		const rows = await usernames();

		expect(Object.keys(rows).length).toBeGreaterThanOrEqual(legacyNames.length);
		expect(rows[1]).toBe('ana-maria');
		expect(rows[2]).toBe('joao-da-silva');
		expect(rows[10]).toBe('caca-niqueis-cia');
	});

	it('numbers a repeated name, and never lets a suffix collide with a name that is already there', async () => {
		const rows = await usernames();

		expect(rows[3]).toBe('ana-maria-2');
		expect(rows[4]).toBe('ana-maria-2-2');
		const taken = Object.values(rows).filter((username) => username !== null);
		expect(new Set(taken).size).toBe(taken.length);
	});

	it('leaves the username empty where nothing acceptable can be made, so the owner is asked at the onboarding', async () => {
		const rows = await usernames();

		expect([rows[5], rows[6], rows[7], rows[8]]).toEqual([null, null, null, null]);
	});

	it('cuts a long name to 30 characters without a hyphen at the end', async () => {
		const username = (await usernames())[9]!;

		expect(username.length).toBeLessThanOrEqual(30);
		expect(username).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
		expect(username.startsWith('mestre-do-dragao-das-trevas')).toBe(true);
	});

	it('refuses two usernames that differ only by case, and a malformed one', async () => {
		const insert = (n: number, username: string) =>
			client.query(`insert into profiles (id, display_name, username) values ($1, 'x', $2)`, [
				uuid(n),
				username
			]);

		await expect(insert(50, 'ANA-MARIA')).rejects.toThrow(/check|unique/i);
		await expect(insert(51, 'joao-da-silva')).rejects.toThrow(/unique/i);
		await expect(insert(52, '-ana')).rejects.toThrow(/check/i);
		await expect(insert(53, 'ana--maria')).rejects.toThrow(/check/i);
	});

	it('lets many profiles wait for onboarding at once', async () => {
		const { rows } = await client.query(
			`insert into profiles (id, display_name) values ($1, 'x'), ($2, 'y') returning username`,
			[uuid(60), uuid(61)]
		);

		expect(rows).toEqual([{ username: null }, { username: null }]);
	});

	it('creates the social links table with row level security, and removes links with their profile', async () => {
		const { rows } = await client.query<{ rls: boolean }>(
			`select relrowsecurity as rls from pg_class where relname = 'profile_social_links'`
		);
		expect(rows[0].rls).toBe(true);

		await client.query(`insert into profiles (id, display_name) values ($1, 'links')`, [uuid(70)]);
		await client.query(
			`insert into profile_social_links (profile_id, network, url, position) values ($1, 'website', 'https://example.com', 0)`,
			[uuid(70)]
		);
		await client.query(`delete from profiles where id = $1`, [uuid(70)]);
		const left = await client.query(`select 1 from profile_social_links`);
		expect(left.rows).toHaveLength(0);
	});
});

describe('0008_drop_display_name', () => {
	let client: PGlite;

	beforeAll(async () => {
		client = new PGlite();
		await applyMigrations(client, { through: '0006_enable_rls' });
		await client.query(`insert into profiles (id, display_name) values ($1, 'Ana Maria')`, [
			uuid(1)
		]);
		await applyMigration(client, '0007_public_profiles');
		await applyMigration(client, '0008_drop_display_name');
	});

	afterAll(() => client.close());

	it('removes the column and keeps the profile, with the username made from it', async () => {
		const { rows } = await client.query<{ username: string | null }>(
			`select username from profiles where id = $1`,
			[uuid(1)]
		);
		expect(rows).toEqual([{ username: 'ana-maria' }]);

		const columns = await client.query(
			`select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'display_name'`
		);
		expect(columns.rows).toHaveLength(0);
	});

	it('lets a profile be created without any name, as the sign-up does', async () => {
		const { rows } = await client.query(`insert into profiles (id) values ($1) returning id`, [
			uuid(2)
		]);

		expect(rows).toHaveLength(1);
	});
});
