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

const gm = { id: '00000000-0000-4000-8000-000000000001', displayName: 'Mestre de Testes' };

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
await db
	.insert(gameTables)
	.values([
		{
			...base,
			slug: 'mesa-do-dragao',
			title: 'Mesa do Dragão',
			systemId: await systemId('dungeons-e-dragons-5e-2014'),
			kind: 'one_shot',
			capacity: 5,
			startsAt: inDays(7, 22),
			description: 'Uma aventura de uma noite para quem nunca jogou.\nNão precisa de experiência.',
			// Markup on purpose: the pages must show it as text.
			extraInfo: 'Traga dados e <b>lápis</b>.'
		},
		{
			...base,
			slug: 'cronicas-de-arton',
			title: 'Crônicas de Arton',
			systemId: await systemId('tormenta-20-t20'),
			kind: 'campaign',
			recurrence: 'FREQ=WEEKLY;BYDAY=SA',
			capacity: 4,
			startsAt: inDays(3, 21),
			joinMode: 'approval'
		},
		{
			...base,
			slug: 'mesa-desativada',
			title: 'Mesa Desativada',
			systemId: await systemId('daggerheart'),
			kind: 'one_shot',
			capacity: 4,
			startsAt: inDays(5, 20),
			// The public pages must never show a disabled table.
			status: 'disabled'
		}
	])
	.onConflictDoNothing();

await client.end();
console.log('Dev data is in place: 1 profile and 3 tables (one disabled).');
