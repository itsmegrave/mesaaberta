// The app on `vite dev` against the local Supabase, with the api next to it: what `bun run dev:up`
// prepared. Usage: bun run dev:local. Stops both when you stop it.
import { spawn } from 'node:child_process';
import { stack } from '../../apps/web/e2e/support/stack.ts';
import { DEV_API_PORT, DEV_API_TOKEN } from './local.ts';

const local = stack();

const api = spawn('bun', ['apps/api/src/entry/bun.ts'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: local.DB_URL,
    API_INTERNAL_TOKEN: DEV_API_TOKEN,
    PORT: String(DEV_API_PORT),
  },
});
const web = spawn('bun', ['run', 'dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  // The Hyperdrive binding wins over DATABASE_URL; this points it at the local Supabase's Postgres.
  env: { ...process.env, CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: local.DB_URL },
});

const stop = () => {
  api.kill();
  web.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
web.on('exit', (code) => {
  api.kill();
  process.exit(code ?? 0);
});
