import { expect, test } from '@playwright/test';

test('English is not served yet: /en is a Portuguese not-found page', async ({ page }) => {
	const response = await page.goto('/en');

	expect(response?.status()).toBe(404);
	await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/não encontrada/i);
});

test.describe('error page', () => {
	test('is translated and links back to the start', async ({ page }) => {
		await page.goto('/nao-existe');

		await expect(page.getByRole('heading', { level: 1 })).toHaveText(/não encontrada/i);
		await expect(page.getByRole('link', { name: /voltar/i })).toHaveAttribute('href', '/');
	});
});
