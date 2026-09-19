import type { Handle } from '@sveltejs/kit';
import { connectionStringFrom, createDb, type DatabaseEnv } from './client';

/**
 * Exposes `locals.db`: the database, or `null` when none is configured (plain `vite dev` without
 * `.dev.vars`, or a deploy before Hyperdrive is set up). The connection is only created if a
 * route reads it, and is closed after the response without holding it up.
 */
export const handleDatabase: Handle = async ({ event, resolve }) => {
	const { env, ctx } = event.platform ?? {};
	const connectionString = connectionStringFrom(env as DatabaseEnv | undefined);
	let connection: ReturnType<typeof createDb> | undefined;

	Object.defineProperty(event.locals, 'db', {
		get: () => (connectionString ? (connection ??= createDb(connectionString)).db : null)
	});

	const response = await resolve(event);

	if (connection) {
		const closing = connection.close();
		if (ctx) ctx.waitUntil(closing);
		else await closing;
	}

	return response;
};
