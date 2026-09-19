// Development data: one GM and a few tables. Safe to run again; existing rows are left alone.
// Usage: pnpm db:seed (needs DATABASE_URL, see .dev.vars.example)
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { gameTables, profiles } from '../src/lib/server/db/schema.ts';

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

await db.insert(profiles).values(gm).onConflictDoNothing();
await db
	.insert(gameTables)
	.values([
		{
			...base,
			slug: 'mesa-do-dragao',
			title: 'Mesa do Dragão',
			system: 'D&D 5e',
			kind: 'one_shot',
			capacity: 5,
			startsAt: inDays(7, 22),
			description: 'Uma aventura de uma noite para quem nunca jogou.'
		},
		{
			...base,
			slug: 'cronicas-de-arton',
			title: 'Crônicas de Arton',
			system: 'Tormenta20',
			kind: 'campaign',
			recurrence: 'FREQ=WEEKLY;BYDAY=SA',
			capacity: 4,
			startsAt: inDays(3, 21),
			joinMode: 'approval'
		}
	])
	.onConflictDoNothing();

await client.end();
console.log('Dev data is in place: 1 profile and 2 tables.');
