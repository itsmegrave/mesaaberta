import { sql, type SQL } from 'drizzle-orm';
import type { Logger } from '../logger';

/** All the health check needs from a database, so any Drizzle driver fits. */
type Queryable = { execute: (query: SQL) => PromiseLike<unknown> };

export type DatabaseHealth = 'ok' | 'down' | 'not_configured';

/** Runs `select 1`. Never throws: an unreachable database is a `down` answer, not an error. */
export async function checkDatabase(db: Queryable | null, log?: Logger): Promise<DatabaseHealth> {
	if (!db) return 'not_configured';

	try {
		await db.execute(sql`select 1`);
		return 'ok';
	} catch (error) {
		log?.error('database health check failed', { error });
		return 'down';
	}
}
