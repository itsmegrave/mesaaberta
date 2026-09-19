import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';

/**
 * A throwaway in-process Postgres with the real migrations applied, so tests run the same SQL
 * (constraints and indexes included) that production does, without a database server.
 */
export async function createTestDb() {
	const client = new PGlite();
	const db = drizzle(client, { schema });
	await migrate(db, { migrationsFolder: 'drizzle' });

	return { db, close: () => client.close() };
}

/** The Postgres error code behind a rejected query (drizzle wraps the driver error as `cause`). */
export async function pgErrorCode(query: PromiseLike<unknown>): Promise<string | undefined> {
	try {
		await query;
	} catch (error) {
		const { code, cause } = error as { code?: string; cause?: { code?: string } };
		return cause?.code ?? code;
	}
}
