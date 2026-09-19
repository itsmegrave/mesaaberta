// Makes someone an admin. They must have signed in once, so their profile exists.
// Usage: pnpm db:make-admin <user id>   (the UID column in Supabase > Authentication > Users)
// Needs DATABASE_URL, see .dev.vars.example; point it at the database you want to change.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { promoteToAdmin } from '../src/lib/server/auth/admin.ts';

const url = process.env.DATABASE_URL;
const userId = process.argv[2];

if (!url) throw new Error('DATABASE_URL is not set. Copy .dev.vars.example to .dev.vars.');
if (!userId) throw new Error('Usage: pnpm db:make-admin <user id>');

const client = postgres(url, { max: 1 });

try {
	const found = await promoteToAdmin(drizzle(client), userId);
	console.log(
		found
			? `${userId} is now an admin.`
			: `No profile for ${userId}. They need to sign in once first.`
	);
	process.exitCode = found ? 0 : 1;
} finally {
	await client.end();
}
