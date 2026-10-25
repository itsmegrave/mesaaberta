import { expect, test } from '@playwright/test';
import { releaseHref, releases } from '../src/lib/changelog';

const oldest = releases.at(-1)!;

test('the footer opens release history, which filters changes and links older days', async ({
  page,
}) => {
  await page.goto('/changelog');
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Novidades', exact: true })).toHaveAttribute(
    'href',
    '/changelog',
  );
  await page.getByRole('link', { name: /^Correções/ }).click();
  await expect(page).toHaveURL(/\/changelog\?tipo=fixed$/);
  const entries = page.locator('article');
  await expect(entries.first()).toBeVisible();
  await expect(entries.getByText('Novo', { exact: true })).toHaveCount(0);
  await expect(entries.getByText('Melhoria', { exact: true })).toHaveCount(0);
  await page.goto(releaseHref(oldest.date));
  await expect(page.locator(`article[id="${oldest.date}"]`)).toBeVisible();
  const response = await page.goto('/changelog?page=999');
  expect(response?.status()).toBe(404);
});

test('highlights advance only when asked and wrap back to the first release', async ({ page }) => {
  await page.goto('/changelog');
  const highlights = page.getByRole('region', { name: 'Destaques' });
  await expect(highlights.getByText('1 de 3', { exact: true })).toBeVisible();
  await highlights.getByRole('button', { name: 'Destaque anterior', exact: true }).click();
  await expect(highlights.getByText('3 de 3', { exact: true })).toBeVisible();
  await highlights.getByRole('button', { name: 'Próximo destaque', exact: true }).click();
  await expect(highlights.getByText('1 de 3', { exact: true })).toBeVisible();
});

test('copying a release day shares its canonical address', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(releaseHref(oldest.date));
  await page
    .locator(`article[id="${oldest.date}"]`)
    .getByRole('button', { name: /^Copiar link de / })
    .click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(new URL(releaseHref(oldest.date), page.url()).href);
  await expect(page.getByRole('status').filter({ hasText: /Link de .* copiado\./ })).toBeVisible();
});
