import { connectionStringFrom, createDb, type DatabaseEnv } from '../db/client';
import type { Logger } from '../logger';
import { sweepEvents } from './dispatcher';
import type { Handler } from './types';

type Deps = { open?: typeof createDb; handlers: readonly Handler[]; log: Logger };

/**
 * One run of the sweeper, called by the Cron Trigger: opens the database, dispatches the events
 * that are due (retries after backoff, and any whose first dispatch never happened), and always
 * closes the connection. Does nothing without a database. Returns how many events it tried.
 */
export async function runSweeper(
	env: DatabaseEnv,
	{ open = createDb, handlers, log }: Deps
): Promise<number> {
	const connectionString = connectionStringFrom(env);
	if (!connectionString) return 0;

	const { db, close } = open(connectionString);
	try {
		const swept = await sweepEvents(db, handlers);
		if (swept > 0) log.info('event sweep', { swept });
		return swept;
	} finally {
		await close();
	}
}
