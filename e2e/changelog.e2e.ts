import { expect, test } from '@playwright/test';

test('the changelog lists the platform launch, dated', async ({ page }) => {
  await page.goto('/changelog');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Novidades');
  const launch = page.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: 'Lançamento da plataforma' }),
  });
  await expect(launch.locator('time')).toHaveAttribute('datetime', '2026-09-29');
});

test('the footer links to the changelog', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('contentinfo').getByRole('link', { name: 'novidades' }).click();
  await expect(page).toHaveURL(/\/changelog$/);
});

test('a changelog page past the last one is not found', async ({ page }) => {
  const response = await page.goto('/changelog?pagina=999');
  expect(response?.status()).toBe(404);
});
