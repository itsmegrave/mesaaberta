// Runs first in `bun run build`. On a Cloudflare Workers Build of main it applies the pending
// migrations to production before the new Worker is deployed, so the code never runs ahead of the
// schema. Anywhere else it does nothing. See src/lib/server/db/deploy-migrations.ts.
//
// It runs Drizzle's migrator itself rather than `drizzle-kit migrate`, which hides the database's
// error behind its spinner: here a failure prints what Postgres said, and where it was connecting.
import { readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { migrationPlan } from '../src/lib/server/db/deploy-migrations.ts';

const plan = migrationPlan(process.env);

if (!plan.run && plan.fail) {
  console.error(`migrations: cannot continue (${plan.reason}).`);
  console.error(
    '  Add the MIGRATE_DATABASE_URL build secret (README, "Deploying"), or set ALLOW_BUILD_WITHOUT_MIGRATIONS=true',
  );
  console.error(
    '  for a deploy that needs no migration. The build stops so code never runs ahead of the schema.',
  );
  process.exit(1);
}

if (!plan.run) {
  const line = `migrations: skipped (${plan.reason})`;
  if (plan.warn) console.warn(`⚠️  ${line}. Run \`bun run db:migrate\` against Supabase by hand.`);
  else console.log(line);
  process.exit(0);
}

// Where it connects, for the log: user, host, port and database, never the password.
const target = (() => {
  try {
    const url = new URL(plan.url);
    return `${url.username}@${url.hostname}:${url.port || 5432}${url.pathname}`;
  } catch {
    return 'an unparseable MIGRATE_DATABASE_URL';
  }
})();

// Supabase signs its database certificates with its own root CA, which is not in Node's trust
// store. Trust exactly that CA (public, in the repo) and keep verifying the host name, rather than
// turning verification off: the password only goes to a server that proves it is Supabase's.
// Downloaded from Supabase (Database settings > SSL); valid until 2031.
const ca = readFileSync(new URL('../supabase/prod-ca-2021.crt', import.meta.url), 'utf8');
// The TLS settings come from here, so an `sslmode` left in the string cannot weaken them.
const url = new URL(plan.url);
url.searchParams.delete('sslmode');

console.log(`migrations: applying the pending ones to production (${target})`);
const sql = postgres(url.toString(), {
  max: 1,
  onnotice: () => {},
  connect_timeout: 15,
  ssl: { ca, rejectUnauthorized: true },
});
try {
  await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
  console.log('migrations: done');
} catch (error) {
  const { message, cause } = error as Error & { cause?: Error & { code?: string } };
  console.error(`migrations: FAILED against ${target}`);
  console.error(`  ${message}`);
  if (cause) console.error(`  cause: ${cause.code ? `[${cause.code}] ` : ''}${cause.message}`);
  // A failed migration stops the build, so the new code is not deployed onto an old schema.
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
