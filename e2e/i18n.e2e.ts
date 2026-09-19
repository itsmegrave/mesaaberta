import { expect, test } from '@playwright/test';

test.describe('English at /en', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/en');
	});

	test('declares the page language as English', async ({ page }) => {
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	});

	test('renders the headline, title and footer in English', async ({ page }) => {
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(/empty chair/i);
		await expect(page).toHaveTitle(/open tables|tabletop/i);
		await expect(page.getByRole('contentinfo')).toContainText('Made with');
	});
});

test.describe('language switch', () => {
	test('goes from Portuguese to English and back', async ({ page }) => {
		await page.goto('/');

		await page.getByRole('banner').getByRole('link', { name: 'English' }).click();
		await expect(page).toHaveURL(/\/en\/?$/);
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');

		await page.getByRole('banner').getByRole('link', { name: 'Português' }).click();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
	});

	test('only offers the language you are not reading', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('banner').getByRole('link', { name: 'Português' })).toHaveCount(0);
	});
});

test.describe('search engine alternates', () => {
	for (const path of ['/', '/en']) {
		test(`from ${path} point to the same page in each language`, async ({ page, baseURL }) => {
			await page.goto(path);

			const href = (hreflang: string) =>
				page.locator(`link[rel="alternate"][hreflang="${hreflang}"]`).getAttribute('href');

			expect(await href('pt-BR')).toBe(`${baseURL}/`);
			expect(await href('en')).toBe(`${baseURL}/en`);
			expect(await href('x-default')).toBe(`${baseURL}/`);
		});
	}
});

test.describe('error page', () => {
	test('is translated and links back to the start of the same language', async ({ page }) => {
		await page.goto('/nao-existe');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(/não encontrada/i);
		await expect(page.getByRole('link', { name: /voltar/i })).toHaveAttribute('href', '/');

		await page.goto('/en/nao-existe');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(/not found/i);
		await expect(page.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/en');
	});
});
