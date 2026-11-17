import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { queryObserver, withQueryObserver, withQueryTiming, type OnQuery } from './query-timing';
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

/**
 * postgres.js connects on the first query, so creating a client is cheap. `onQuery`, when given, is
 * called with the seconds each query took (see `withQueryTiming`); the observer set with
 * `observeQueries` sees every query too.
 */
export function createDb(connectionString: string, options: { onQuery?: OnQuery } = {}) {
  // `fetch_types: false` skips a startup round trip; Hyperdrive is the pool, so keep this small.
  const client = postgres(connectionString, { max: 5, fetch_types: false });
  const timedClient = options.onQuery ? withQueryTiming(client, options.onQuery) : client;
  // Read when the client is made, so the api's observer (set once at startup) sees every query.
  const observer = queryObserver();
  const watchedClient = observer ? withQueryObserver(timedClient, observer) : timedClient;

  return { db: drizzle(watchedClient, { schema }), close: () => client.end() };
}
export { observeQueries, type QueryObserver } from './query-timing';
