import { defineConfig, devices } from '@playwright/test';
import { healthToken } from './e2e/support/health';
import { stack } from './e2e/support/stack';

const port = 4173;
// A second server on the same build with the site in maintenance (see e2e/maintenance.e2e.ts).
const maintenancePort = 4183;
const apiPort = 4185;
// Local test-only secret for the HTTP adapter; new features never fall back to web DB writes.
const apiToken = 'mesaaberta-e2e-only';
// The local Supabase (`bun run e2e:up`): its Postgres is the app's database and its Auth is the app's login.
const supabase = stack();

const serverVars = [
  `--var APP_ORIGIN:http://localhost:${port}`,
  `--var API_URL:http://127.0.0.1:${apiPort}`,
  `--var API_INTERNAL_TOKEN:${apiToken}`,
  `--var HEALTHZ_TOKEN:${healthToken}`,
  `--var SUPABASE_URL:${supabase.API_URL}`,
  `--var SUPABASE_PUBLISHABLE_KEY:${supabase.PUBLISHABLE_KEY}`,
  // The local stack's secret key: account deletion removes the Auth user through the Admin API.
  `--var SUPABASE_SECRET_KEY:${supabase.SECRET_KEY}`,
  // E2E uses Supabase's local Mailpit as the transactional e-mail provider, even if .dev.vars has
  // real Resend credentials for a deliberate smoke test.
  `--var MAILPIT_URL:${supabase.MAILPIT_URL}`,
  // E2E runs on the feature-flag defaults from the registry, never on production's live values:
  // no forced flags (unlike .dev.vars' preview mode) and no GrowthBook key, so the tests do
  // not change when someone flips a flag in GrowthBook.
  '--var IGNORE_FEATURE_FLAGS_IN_LOCALHOST:false',
  '--var GROWTHBOOK_CLIENT_KEY:',
  // The contact points the footer and the legal pages show are deployment values.
  '--var CONTACT_EMAIL:contato@example.test',
  '--var PRIVACY_EMAIL:privacidade@example.test',
  '--var INSTAGRAM_HANDLE:mesaaberta.test',
  // On purpose: security.e2e.ts checks the dev login is still a 404 in a production build.
  '--var DEV_LOGIN:true',
];

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // Signed-in flows share one database, so tests run one after the other, not in parallel; CI splits
  // the suite across runners (--shard), each with its own database.
  workers: 1,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    // Times follow the browser's zone; pin it so a runner in UTC sees what a player in Brazil does.
    timezoneId: 'America/Sao_Paulo',
  },
  webServer: [
    {
      command: 'bun apps/api/src/entry/bun.ts',
      cwd: '../..',
      env: {
        DATABASE_URL: supabase.DB_URL,
        API_INTERNAL_TOKEN: apiToken,
        PORT: String(apiPort),
        // Public profiles answer picture URLs, built from the same storage the web app uses.
        SUPABASE_URL: supabase.API_URL,
        // The auth forms run here only (no web fallback): Supabase Auth and the local Mailpit.
        SUPABASE_PUBLISHABLE_KEY: supabase.PUBLISHABLE_KEY,
        MAILPIT_URL: supabase.MAILPIT_URL,
        // Closing an account deletes its Auth user, from here only.
        SUPABASE_SECRET_KEY: supabase.SECRET_KEY,
      },
      url: `http://127.0.0.1:${apiPort}/healthz`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // The built app on the Workers runtime, pointed at the local Supabase instead of production.
      command: [
        // Only local validation may reuse an explicitly prepared build; CI always builds here.
        ...(process.env.E2E_PREBUILT === 'true'
          ? []
          : [`CSP_EXTRA_IMG_SRC=${supabase.API_URL} bun run build &&`]),
        `bun run wrangler dev apps/web/.svelte-kit/cloudflare/_worker.js --port ${port}`,
        ...serverVars,
      ].join(' '),
      // Commands run from the repository root, where `package.json` and `wrangler.jsonc` are.
      cwd: '../..',
      // Overrides the Hyperdrive binding's local connection string (see wrangler.jsonc).
      env: { CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: supabase.DB_URL },
      port,
      // Reusing a developer's server can bypass the Mailpit provider above. Failing on a busy port
      // is intentional: it is safer than allowing an E2E test to inherit real Resend credentials.
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      // The same build with only the maintenance flag forced on (honoured on localhost only).
      // Playwright starts both servers at once, so this one waits for the first, which builds.
      cwd: '../..',
      command: [
        `until curl -sf -o /dev/null -H 'authorization: Bearer ${healthToken}' http://localhost:${port}/healthz; do sleep 1; done &&`,
        `bun run wrangler dev apps/web/.svelte-kit/cloudflare/_worker.js --port ${maintenancePort}`,
        '--persist-to .wrangler/state-maintenance',
        ...serverVars,
        '--var FEATURE_FLAG_OVERRIDES:maintenance_mode=true',
      ].join(' '),
      env: { CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: supabase.DB_URL },
      port: maintenancePort,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: 'maintenance.e2e.ts' },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: 'maintenance.e2e.ts' },
    {
      name: 'maintenance',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${maintenancePort}` },
      testMatch: 'maintenance.e2e.ts',
    },
  ],
});
