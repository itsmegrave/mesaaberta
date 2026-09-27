// Runs first in `pnpm build`. On a Cloudflare Workers Build of main it applies the pending
// migrations to production before the new Worker is deployed, so the code never runs ahead of the
// schema. Anywhere else it does nothing. See src/lib/server/db/deploy-migrations.ts.
import { spawnSync } from 'node:child_process';
import { migrationPlan } from '../src/lib/server/db/deploy-migrations.ts';

const plan = migrationPlan(process.env);

if (!plan.run) {
	const line = `migrations: skipped (${plan.reason})`;
	if (plan.warn) console.warn(`⚠️  ${line}. Run \`pnpm db:migrate\` against Supabase by hand.`);
	else console.log(line);
	process.exit(0);
}

console.log('migrations: applying the pending ones to production');
const result = spawnSync('node', ['./node_modules/drizzle-kit/bin.cjs', 'migrate'], {
	stdio: 'inherit',
	env: { ...process.env, DATABASE_URL: plan.url }
});
// A failed migration stops the build, so the new code is not deployed onto an old schema.
process.exit(result.status ?? 1);
