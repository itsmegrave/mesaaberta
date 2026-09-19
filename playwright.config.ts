import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
	webServer: {
		command: 'pnpm run build && pnpm run preview',
		port,
		reuseExistingServer: !process.env.CI
	},
	projects: [
		{ name: 'mobile', use: { ...devices['Pixel 7'] } },
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }
	]
});
