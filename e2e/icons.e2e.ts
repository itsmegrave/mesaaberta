import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
});

test('every icon and the manifest are real URLs, not inlined data URIs', async ({ page }) => {
	const hrefs = await page
		.locator('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')
		.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));

	expect(hrefs.length).toBeGreaterThanOrEqual(4);
	for (const href of hrefs) expect(href).not.toMatch(/^data:/);
});

test('the manifest is served, is named, and every icon it lists resolves', async ({
	page,
	request
}) => {
	const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
	const response = await request.get(manifestHref!);
	expect(response.ok()).toBe(true);

	const manifest = await response.json();
	expect(manifest.name).not.toBe('');
	expect(manifest.icons.length).toBeGreaterThan(0);

	for (const icon of manifest.icons) {
		const iconResponse = await request.get(icon.src);
		expect(iconResponse.ok(), icon.src).toBe(true);
		expect(iconResponse.headers()['content-type'], icon.src).toMatch(/^image\/png/);
	}
});

test('the browser default /favicon.ico is served', async ({ request }) => {
	expect((await request.get('/favicon.ico')).ok()).toBe(true);
});
