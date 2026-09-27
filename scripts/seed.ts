// Development data: one GM and a few tables. The RPG systems themselves come from the migrations. Safe to run again; existing rows are left alone.
// Usage: pnpm db:seed (needs DATABASE_URL, see .dev.vars.example)
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { gameTables, profiles, systems } from '../src/lib/server/db/schema.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set. Copy .dev.vars.example to .dev.vars.');

const client = postgres(url, { max: 1 });
const db = drizzle(client);

const gm = {
	id: '00000000-0000-4000-8000-000000000001',
	username: 'mestre-de-testes',
	name: 'Mestre de Testes'
};

const inDays = (days: number, hour: number) => {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + days);
	date.setUTCHours(hour, 0, 0, 0);
	return date;
};

const base = { timezone: 'America/Sao_Paulo', durationMinutes: 240, gmId: gm.id };

const systemId = async (slug: string) => {
	const [system] = await db.select({ id: systems.id }).from(systems).where(eq(systems.slug, slug));
	if (!system) throw new Error(`No system "${slug}". Run pnpm db:migrate first.`);
	return system.id;
};

await db.insert(profiles).values(gm).onConflictDoNothing();

const tables = [
	{
		...base,
		slug: 'os-sinos-de-sablewood',
		title: 'Os Sinos de Sablewood',
		systemId: await systemId('daggerheart'),
		kind: 'one_shot' as const,
		capacity: 5,
		startsAt: inDays(7, 22),
		description: 'Uma aventura de uma noite para quem nunca jogou.\nNão precisa de experiência.',
		// Markup on purpose: the pages must show it as text.
		extraInfo: 'Traga dados e <b>lápis</b>.'
	},
	{
		...base,
		slug: 'cronicas-de-roshar',
		title: 'Crônicas de Roshar',
		systemId: await systemId('cosmere-roleplaying-game'),
		kind: 'campaign' as const,
		recurrence: 'FREQ=WEEKLY;BYDAY=SA',
		capacity: 4,
		startsAt: inDays(3, 21),
		joinMode: 'approval' as const
	},
	{
		...base,
		slug: 'noites-de-neon',
		title: 'Noites de Neon',
		systemId: await systemId('urban-shadows-2e'),
		kind: 'one_shot' as const,
		capacity: 4,
		startsAt: inDays(10, 22),
		modality: 'in_person' as const,
		locationArea: 'Boa Viagem, Recife - PE'
	},
	{
		...base,
		slug: 'a-cripta-do-rei-afogado',
		title: 'A Cripta do Rei Afogado',
		systemId: await systemId('old-dragon-2-edicao'),
		kind: 'one_shot' as const,
		capacity: 5,
		startsAt: inDays(12, 22)
	},
	{
		...base,
		slug: 'a-ultima-estrada',
		title: 'A Última Estrada',
		systemId: await systemId('savage-worlds'),
		kind: 'one_shot' as const,
		capacity: 4,
		startsAt: inDays(5, 20),
		// The public pages must never show a disabled table.
		status: 'disabled' as const
	}
];

// Running it again moves the sessions back to the days above, so the dates never go stale.
for (const table of tables) {
	await db
		.insert(gameTables)
		.values(table)
		.onConflictDoUpdate({ target: gameTables.slug, set: { startsAt: table.startsAt } });
}

await client.end();
console.log(`Dev data is in place: 1 profile and ${tables.length} tables (one disabled).`);
