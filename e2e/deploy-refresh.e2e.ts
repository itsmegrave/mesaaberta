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

test('loads the next page from the server once a new build is deployed', async ({ page }) => {
  await page.route('**/_app/version.json', (route) =>
    route.fulfill({ json: { version: 'a-newer-deploy' } }),
  );
  await page.clock.runFor(61_000);
  await page.getByRole('banner').getByRole('link', { name: 'Mesa Aberta' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('banner')).toBeVisible();
  expect(await isMarked(page)).toBe(false);
});
