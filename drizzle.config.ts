import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	// Only `db:migrate` connects; `db:generate` reads the schema alone.
	dbCredentials: { url: process.env.DATABASE_URL ?? '' }
});
