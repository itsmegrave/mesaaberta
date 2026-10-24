import { expect, test } from '@playwright/test';

for (const prefix of ['/en', '/pt-BR']) {
  test(`legacy locale ${prefix} redirects to the Portuguese home page`, async ({
    page,
    request,
  }) => {
    const redirect = await request.get(prefix, { maxRedirects: 0 });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers().location).toBe('/');

    const response = await page.goto(prefix);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
}

test.describe('error page', () => {
  test('is translated and links back to the start', async ({ page }) => {
    await page.goto('/nao-existe');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/não encontrada/i);
    await expect(page.getByRole('link', { name: /voltar/i })).toHaveAttribute('href', '/');
  });
});
