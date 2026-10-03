// Puts the app's tables and dev data into the local Supabase's Postgres, so the e2e tests have
// something to read. Run by `bun run e2e:up` after the stack starts; safe to run again.
import { execFileSync } from 'node:child_process';
import { stack } from '../e2e/support/stack.ts';

const env = { ...process.env, DATABASE_URL: stack().DB_URL };

execFileSync(process.execPath, ['node_modules/drizzle-kit/bin.cjs', 'migrate'], {
  env,
  stdio: 'inherit',
});
execFileSync(process.execPath, ['scripts/seed.ts'], { env, stdio: 'inherit' });
