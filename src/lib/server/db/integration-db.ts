import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * A pooled connection to the real Postgres in `DATABASE_URL`, for the integration tests. Several
 * connections, so concurrent transactions truly overlap; PGlite is one connection and cannot race.
 * The migrations must already be applied (`pnpm db:up && pnpm db:migrate`).
 */
export function openIntegrationDb() {
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error(
			'The integration tests need a real Postgres: set DATABASE_URL (see .dev.vars.example), then run `pnpm db:up && pnpm db:migrate`.'
		);
	}

	const client = postgres(url, { max: 10, onnotice: () => {} });
	return { db: drizzle(client, { schema }), close: () => client.end() };
}
