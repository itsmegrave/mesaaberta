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

const toggle = (page: import('@playwright/test').Page) =>
	page.getByRole('button', { name: 'Tema escuro' });

test.describe('the mode follows the system by default', () => {
	test('a dark system gets a dark page and a light system a pale one, both readable', async ({
		browser
	}) => {
		const light = await open(browser, 'light');
		const dark = await open(browser, 'dark');
		const l = await colours(light.page);
		const d = await colours(dark.page);

		await expect(light.page.locator('html')).toHaveAttribute('data-mode', 'light');
		await expect(dark.page.locator('html')).toHaveAttribute('data-mode', 'dark');
		expect(luminance(d.background)).toBeLessThan(luminance(l.background));
		expect(contrast(d.background, d.text)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(l.background, l.text)).toBeGreaterThanOrEqual(4.5);
		expect(d.scheme).toBe('dark');
		await light.context.close();
		await dark.context.close();
	});
});

test.describe('a manual choice overrides the system', () => {
	test('light on a dark system is the same page as light on a light system', async ({
		browser
	}) => {
		const chosen = await open(browser, 'dark', 'light');
		const plain = await open(browser, 'light');

		await expect(chosen.page.locator('html')).toHaveAttribute('data-mode', 'light');
		expect((await colours(chosen.page)).background).toBe((await colours(plain.page)).background);
		await chosen.context.close();
		await plain.context.close();
	});

	test('the toggle changes the page at once and the choice survives a reload', async ({
		browser
	}) => {
		const { page, context } = await open(browser, 'light');
		const before = (await colours(page)).background;

		await toggle(page).click();
		await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
		expect((await colours(page)).background).not.toBe(before);

		await page.reload();

		await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
		await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
		await context.close();
	});

	test('paints the browser chrome in the chosen mode', async ({ browser }) => {
		const { page, context } = await open(browser, 'light', 'dark');

		const metas = await page
			.locator('meta[name="theme-color"]')
			.evaluateAll((els) => els.map((e) => e.getAttribute('content')));

		expect(metas[0]).toBe(metas[1]);
		expect(metas[0]).toBe(
			await page.evaluate(() => {
				const canvas = document.createElement('canvas');
				canvas.width = canvas.height = 1;
				const ctx = canvas.getContext('2d')!;
				ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
				ctx.fillRect(0, 0, 1, 1);
				const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
				return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
			})
		);
		await context.close();
	});
});

test.describe('no flash', () => {
	test('with dark chosen, the mode is already set when the body first appears', async ({
		browser
	}) => {
		const context = await browser.newContext({ colorScheme: 'light' });
		await context.addInitScript(() => {
			localStorage.setItem('theme', 'dark');
			new MutationObserver((_, observer) => {
				if (!document.body) return;
				(window as unknown as { __modeAtBody?: string }).__modeAtBody =
					document.documentElement.dataset.mode;
				observer.disconnect();
			}).observe(document, { childList: true, subtree: true });
		});
		const page = await context.newPage();

		await page.goto('/');

		const atBody = await page.evaluate(
			() => (window as unknown as { __modeAtBody?: string }).__modeAtBody
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
