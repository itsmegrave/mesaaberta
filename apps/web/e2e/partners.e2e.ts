import { expect, test } from '@playwright/test';

// The partners page is for anyone to read; sending one needs an account.
test.describe('partners page, anonymous', () => {
  test('opens without sending the visitor to sign in', async ({ page }) => {
    await page.goto('/partners');

    await expect(page).toHaveURL(/\/partners$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Parceiros' })).toBeVisible();
  });

  test('asks to sign in only when adding a partner', async ({ page }) => {
    await page.goto('/partners/new');

    await expect(page).toHaveURL(/\/login\?next=%2Fpartners%2Fnew/);
  });

  test('answers 404 for a page past the last', async ({ page }) => {
    const response = await page.goto('/partners?page=999');

    expect(response?.status()).toBe(404);
  });

  test('reads a page that is not a positive whole number as the first', async ({ page }) => {
    const response = await page.goto('/partners?page=abc');

    expect(response?.status()).toBe(200);
  });
});
