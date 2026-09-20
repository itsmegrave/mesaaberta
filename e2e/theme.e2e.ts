import { expect, test, type Browser } from '@playwright/test';

type Scheme = 'light' | 'dark';

/** A page in a context whose system is `scheme`, optionally with a theme already chosen. */
const open = async (browser: Browser, scheme: Scheme, chosen?: Scheme | 'system') => {
	const context = await browser.newContext({ colorScheme: scheme });
	if (chosen) await context.addInitScript((value) => localStorage.setItem('theme', value), chosen);
	const page = await context.newPage();
	await page.goto('/');
	return { page, context };
};

const colours = (page: import('@playwright/test').Page) =>
	page.evaluate(() => {
		const style = getComputedStyle(document.documentElement);
		return { background: style.backgroundColor, text: style.color, scheme: style.colorScheme };
	});

const rgb = (value: string) =>
	value
		.match(/\d+(\.\d+)?/g)!
		.slice(0, 3)
		.map(Number);
const luminance = (value: string) => {
	const [r, g, b] = rgb(value)
		.map((c) => c / 255)
		.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

test.describe('the theme follows the system by default', () => {
	test('the page background and the text differ between a light and a dark system', async ({
		browser
	}) => {
		const light = await open(browser, 'light');
		const dark = await open(browser, 'dark');

		const l = await colours(light.page);
		const d = await colours(dark.page);

		expect(d.background).not.toBe(l.background);
		expect(d.text).not.toBe(l.text);
		expect(luminance(d.background)).toBeLessThan(0.05); // a dark page
		expect(luminance(l.background)).toBeGreaterThan(0.5); // a pale one
		expect(contrast(d.background, d.text)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(l.background, l.text)).toBeGreaterThanOrEqual(4.5);
		await light.context.close();
		await dark.context.close();
	});

	test('tells the browser which scheme it is, for scrollbars and form controls', async ({
		browser
	}) => {
		const dark = await open(browser, 'dark');

		expect((await colours(dark.page)).scheme).toBe('dark');
		await dark.context.close();
	});
});

test.describe('a manual choice overrides the system', () => {
	test('light on a dark system is light', async ({ browser }) => {
		const chosen = await open(browser, 'dark', 'light');
		const plain = await open(browser, 'light');

		expect((await colours(chosen.page)).background).toBe((await colours(plain.page)).background);
		await chosen.context.close();
		await plain.context.close();
	});

	test('dark on a light system is dark', async ({ browser }) => {
		const chosen = await open(browser, 'light', 'dark');
		const plain = await open(browser, 'dark');

		expect((await colours(chosen.page)).background).toBe((await colours(plain.page)).background);
		await chosen.context.close();
		await plain.context.close();
	});

	test('choosing in the header changes the page at once, and the choice survives a reload', async ({
		browser
	}) => {
		const { page, context } = await open(browser, 'light');
		const before = (await colours(page)).background;

		await page.getByRole('combobox', { name: 'Tema' }).selectOption('dark');
		await expect.poll(async () => (await colours(page)).background).not.toBe(before);

		await page.reload();

		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await expect(page.getByRole('combobox', { name: 'Tema' })).toHaveValue('dark');
		expect(luminance((await colours(page)).background)).toBeLessThan(0.05);
		await context.close();
	});

	test('going back to automatic forgets the choice', async ({ browser }) => {
		// Chosen through the control itself: an init script would set it again on every load.
		const { page, context } = await open(browser, 'light');
		await page.getByRole('combobox', { name: 'Tema' }).selectOption('dark');
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

		await page.getByRole('combobox', { name: 'Tema' }).selectOption('system');
		await page.reload();

		await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
		expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();
		expect(luminance((await colours(page)).background)).toBeGreaterThan(0.5);
		await context.close();
	});

	test('paints the browser chrome in the chosen theme', async ({ browser }) => {
		const { page, context } = await open(browser, 'light', 'dark');

		const metas = await page
			.locator('meta[name="theme-color"]')
			.evaluateAll((els) => els.map((e) => e.getAttribute('content')));

		expect(metas).toEqual(['#0e1b1e', '#0e1b1e']);
		await context.close();
	});
});

test.describe('no flash', () => {
	test('with dark chosen, the theme is already set when the body first appears (before the first paint)', async ({
		browser
	}) => {
		const context = await browser.newContext({ colorScheme: 'light' });
		await context.addInitScript(() => {
			localStorage.setItem('theme', 'dark');
			// Records what <html> says at the moment <body> is inserted: nothing has been painted before that.
			new MutationObserver((_, observer) => {
				if (!document.body) return;
				(window as unknown as { __themeAtBody: string | undefined }).__themeAtBody =
					document.documentElement.dataset.theme;
				observer.disconnect();
			}).observe(document, { childList: true, subtree: true });
		});
		const page = await context.newPage();

		await page.goto('/');

		const atBody = await page.evaluate(
			() => (window as unknown as { __themeAtBody?: string }).__themeAtBody
		);
		expect(atBody).toBe('dark');
		await context.close();
	});

	test('the script that does it is in the head, before the stylesheet, and the CSP allows it', async ({
		request
	}) => {
		const response = await request.get('/');
		const html = await response.text();
		const nonce = response.headers()['content-security-policy'].match(/'nonce-([^']+)'/)?.[1];

		expect(nonce).toBeTruthy();
		const script = html.indexOf(`<script nonce="${nonce}">`);
		expect(script).toBeGreaterThan(-1);
		expect(script).toBeLessThan(html.indexOf('rel="stylesheet"'));
	});
});

test.describe('the hero table in the dark theme', () => {
	test('the empty seat still stands out from the page', async ({ browser }) => {
		const { page, context } = await open(browser, 'dark');

		const seat = await page
			.locator('svg circle[stroke-dasharray]')
			.evaluate((el) => getComputedStyle(el).stroke);
		const background = (await colours(page)).background;

		expect(contrast(seat, background)).toBeGreaterThanOrEqual(3);
		await context.close();
	});

	test('recolours with the theme instead of keeping the light palette', async ({ browser }) => {
		const light = await open(browser, 'light');
		const dark = await open(browser, 'dark');
		const fill = (page: import('@playwright/test').Page) =>
			page
				.locator('svg circle.fill-petrol')
				.first()
				.evaluate((el) => getComputedStyle(el).fill);

		expect(await fill(dark.page)).not.toBe(await fill(light.page));
		await light.context.close();
		await dark.context.close();
	});
});
