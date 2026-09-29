import { defineConfig, devices } from '@playwright/test';
import { stack } from './e2e/support/stack';

const port = 4173;
// The local Supabase (`pnpm e2e:up`): its Postgres is the app's database and its Auth is the app's login.
const supabase = stack();

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // Signed-in flows share one database, so tests run one after the other, not in parallel.
  workers: 1,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    // Times follow the browser's zone; pin it so a runner in UTC sees what a player in Brazil does.
    timezoneId: 'America/Sao_Paulo',
  },
  webServer: {
    // The built app on the Workers runtime, pointed at the local Supabase instead of production.
    command: [
      `CSP_EXTRA_IMG_SRC=${supabase.API_URL} pnpm run build &&`,
      `wrangler dev .svelte-kit/cloudflare/_worker.js --port ${port}`,
      `--var SUPABASE_URL:${supabase.API_URL}`,
      `--var SUPABASE_PUBLISHABLE_KEY:${supabase.PUBLISHABLE_KEY}`,
      // The local stack's secret key: account deletion removes the Auth user through the Admin API.
      `--var SUPABASE_SECRET_KEY:${supabase.SECRET_KEY}`,
      // E2E runs on the feature-flag defaults from the registry, never on production's live values:
      // no forced flags (unlike .dev.vars' preview mode) and no GrowthBook key, so the tests do
      // not change when someone flips a flag in GrowthBook.
      '--var IGNORE_FEATURE_FLAGS_IN_LOCALHOST:false',
      '--var GROWTHBOOK_CLIENT_KEY:',
    ].join(' '),
    // Overrides the Hyperdrive binding's local connection string (see wrangler.jsonc).
    env: { CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: supabase.DB_URL },
    port,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
});
