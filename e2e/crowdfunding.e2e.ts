import { expect, test } from '@playwright/test';

// Like the table list, the crowdfunding list is for anyone: no sign-in to read it.
test.describe('crowdfunding list, anonymous', () => {
  test('opens without sending the visitor to sign in', async ({ page }) => {
    await page.goto('/crowdfunding');

    await expect(page).toHaveURL(/\/crowdfunding$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Financiamentos coletivos' }),
    ).toBeVisible();
  });

  test('offers to add one, and asks to sign in only then', async ({ page }) => {
    await page.goto('/crowdfunding');

    await page.getByRole('link', { name: 'Adicionar financiamento' }).click();

    await expect(page).toHaveURL(/\/login\?next=%2Fcrowdfunding%2Fnew/);
  });

  test('the link reader, which fetches addresses for a member, refuses a visitor', async ({
    request,
  }) => {
    const reader = await request.get('/crowdfunding/preview?url=https://catarse.me/x', {
      maxRedirects: 0,
    });

    expect(reader.status()).toBe(401);
  });
});
