import { expect, test, type Page } from '@playwright/test';

/** Marks the loaded document: a client-side navigation keeps the mark, a full page load drops it. */
async function markDocument(page: Page) {
  await page.evaluate(() => ((window as unknown as { __marked: boolean }).__marked = true));
}
const isMarked = (page: Page) =>
  page.evaluate(() => (window as unknown as { __marked?: boolean }).__marked === true);

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto('/privacy');
  await markDocument(page);
});

test('navigates inside the page while the build is current', async ({ page }) => {
  await page.clock.runFor(61_000);
  await page.getByRole('banner').getByRole('link', { name: 'Mesa Aberta' }).click();

  await expect(page).toHaveURL('/');
  expect(await isMarked(page)).toBe(true);
});

test('offers a refresh instead of interrupting a navigation once a new build is deployed', async ({
  page,
}) => {
  await page.route('**/_app/version.json', (route) =>
    route.fulfill({ json: { version: 'a-newer-deploy' } }),
  );
  await page.clock.runFor(61_000);

  await expect(page.getByRole('status')).toContainText('Uma nova versão está disponível.');
  await page.getByRole('banner').getByRole('link', { name: 'Mesa Aberta' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('banner')).toBeVisible();
  expect(await isMarked(page)).toBe(true);

  await page.getByRole('button', { name: 'Atualizar' }).click();
  await expect(page.getByRole('banner')).toBeVisible();
  expect(await isMarked(page)).toBe(false);
});
