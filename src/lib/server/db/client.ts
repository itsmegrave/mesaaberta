import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

/** Any Drizzle Postgres driver: postgres.js in the Worker, PGlite in tests. */
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/** The Worker bindings that can hold a connection string. Neither exists until it is configured. */
export type DatabaseEnv = { HYPERDRIVE?: { connectionString: string }; DATABASE_URL?: string };

/**
 * Deployed, the Worker reaches Postgres through a Hyperdrive binding. `DATABASE_URL` (from
 * `.dev.vars`) is the local fallback. With neither, the app runs without a database.
 */
export const connectionStringFrom = (env: DatabaseEnv | undefined) =>
	env?.HYPERDRIVE?.connectionString || env?.DATABASE_URL || undefined;

/** postgres.js connects on the first query, so creating a client is cheap. */
export function createDb(connectionString: string) {
	// `fetch_types: false` skips a startup round trip; Hyperdrive is the pool, so keep this small.
	const client = postgres(connectionString, { max: 5, fetch_types: false });

	return { db: drizzle(client, { schema }), close: () => client.end() };
}
