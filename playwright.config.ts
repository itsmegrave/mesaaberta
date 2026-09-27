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
	use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
	webServer: {
		// The built app on the Workers runtime, pointed at the local Supabase instead of production.
		command: [
			`CSP_EXTRA_IMG_SRC=${supabase.API_URL} pnpm run build &&`,
			`wrangler dev .svelte-kit/cloudflare/_worker.js --port ${port}`,
			`--var SUPABASE_URL:${supabase.API_URL}`,
			`--var SUPABASE_PUBLISHABLE_KEY:${supabase.PUBLISHABLE_KEY}`,
			// E2E mirrors the feature-flag defaults used in CI instead of .dev.vars' local preview mode.
			'--var IGNORE_FEATURE_FLAGS_IN_LOCALHOST:false'
		].join(' '),
		// Overrides the Hyperdrive binding's local connection string (see wrangler.jsonc).
		env: { CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: supabase.DB_URL },
		port,
		reuseExistingServer: !process.env.CI
	},
	projects: [
		{ name: 'mobile', use: { ...devices['Pixel 7'] } },
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }
	]
});
