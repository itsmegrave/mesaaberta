import { expect, test, type Page } from '@playwright/test';
import { asUser, homeLink } from './support/app';
import { createUser } from './support/users';

/** Marks the loaded document: a client-side navigation keeps the mark, a full page load drops it. */
async function markDocument(page: Page) {
  await page.evaluate(() => ((window as unknown as { __marked: boolean }).__marked = true));
}
const isMarked = (page: Page) =>
  page.evaluate(() => (window as unknown as { __marked?: boolean }).__marked === true);

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto('/privacy');
  // The scripts must have run before the click, or it is a plain link and a full page load.
  await page.waitForLoadState('networkidle');
  await markDocument(page);
});

test('navigates inside the page while the build is current', async ({ page }) => {
  await page.clock.runFor(61_000);
  await homeLink(page).click();

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
  await homeLink(page).click();

  await expect(page).toHaveURL('/');
  await expect(homeLink(page)).toBeVisible();
  expect(await isMarked(page)).toBe(true);

  await page.getByRole('button', { name: 'Atualizar' }).click();
  await expect(homeLink(page)).toBeVisible();
  expect(await isMarked(page)).toBe(false);
});

test.describe('signed in', () => {
  test.skip(({ isMobile }) => isMobile, 'signed-in flows run on desktop only');

  test('pins the new version in the bell and the feed, and asks before a refresh loses a draft', async ({
    browser,
  }) => {
    const { page, context } = await asUser(browser, await createUser('Versão Nova'));
    await page.clock.install();
    await page.goto('/n?unread=1');
    await page.waitForLoadState('networkidle');
    await page.route('**/_app/version.json', (route) =>
      route.fulfill({ json: { version: 'a-newer-deploy' } }),
    );
    await page.clock.runFor(61_000);

    // One item in the feed and one in the bell, apart from the unread count.
    await expect(page.getByTestId('app-update-notice')).toHaveCount(1);
    await page
      .getByRole('button', { name: /^Notificações/ })
      .first()
      .click();
    await expect(page.getByTestId('app-update-notice')).toHaveCount(2);
    await page.keyboard.press('Escape');

    await page.goto('/u/profile/edit');
    await page.waitForLoadState('networkidle');
    await page.clock.runFor(61_000);
    await page.getByRole('textbox', { name: /^Bio/ }).fill('Um rascunho que não pode sumir');
    await markDocument(page);

    await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(page.getByRole('textbox', { name: /^Bio/ })).toHaveValue(
      'Um rascunho que não pode sumir',
    );
    expect(await isMarked(page)).toBe(true);

    await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
    await page.getByRole('button', { name: 'Sair sem salvar' }).click();
    await expect(page).toHaveURL('/u/profile/edit');
    await expect(page.getByRole('textbox', { name: /^Bio/ })).toBeVisible();
    expect(await isMarked(page)).toBe(false);
    await context.close();
  });
});
