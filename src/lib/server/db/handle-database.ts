import type { Handle } from '@sveltejs/kit';
import { connectionStringFrom, createDb, type Db, type DatabaseEnv } from './client';

/**
 * Exposes `locals.db`: the database, or `null` when none is configured (plain `vite dev` without
 * `.dev.vars`, or a deploy before Hyperdrive is set up). The connection is only created if a
 * route reads it, and is closed after the response without holding it up.
 *
 * `locals.afterResponse(task)` queues work to run once the response is on its way, with the same
 * database, for things that must not slow the request (dispatching a domain event). The
 * connection stays open until every task has finished. A failing task is logged, never thrown.
 */
export const handleDatabase: Handle = async ({ event, resolve }) => {
	const { env, ctx } = event.platform ?? {};
	const connectionString = connectionStringFrom(env as DatabaseEnv | undefined);
	let connection: ReturnType<typeof createDb> | undefined;
	const tasks: ((db: Db) => Promise<unknown>)[] = [];

	Object.defineProperty(event.locals, 'db', {
		get: () => (connectionString ? (connection ??= createDb(connectionString)).db : null)
	});
	event.locals.afterResponse = (task) => void tasks.push(task);

	const response = await resolve(event);

	const finish = async () => {
		const db = event.locals.db;
		if (db) {
			await Promise.all(
				tasks.map((task) =>
					task(db).catch((error: unknown) =>
						event.locals.log?.error('after-response task failed', { error })
					)
				)
			);
		}
		await connection?.close();
	};

	if (connection || (tasks.length > 0 && connectionString)) {
		const finishing = finish();
		if (ctx) ctx.waitUntil(finishing);
		else await finishing;
	}

	return response;
};
