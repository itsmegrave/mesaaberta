import { expect, test } from '@playwright/test';
import { asUser } from './support/app';
import { createUser } from './support/users';

test.skip(({ isMobile }) => isMobile, 'signed-in flows run on desktop only');

test('leaving a table form with changes asks first, and staying keeps what was typed', async ({
  browser,
}) => {
  const { page, context } = await asUser(browser, await createUser('Mestra Ana'));
  await page.goto('/tables/new');
  await page.getByLabel('Título').fill('Uma mesa pela metade');

  await page.getByRole('banner').getByRole('link', { name: 'Mesa Aberta' }).click();

  const dialog = page.getByRole('alertdialog', { name: 'Sair sem salvar?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/tables\/new$/);
  await expect(page.getByLabel('Título')).toHaveValue('Uma mesa pela metade');

  await page.getByRole('banner').getByRole('link', { name: 'Mesa Aberta' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sair sem salvar' }).click();
  await expect(page).toHaveURL(/\/$/);
  await context.close();
});

test('a table form refuses an image that is too big before sending anything', async ({
  browser,
}) => {
  const { page, context } = await asUser(browser, await createUser('Mestra Bia'));
  await page.goto('/tables/new');
  let posted = false;
  page.on('request', (request) => {
    if (request.method() === 'POST') posted = true;
  });

  await page.locator('input#image').setInputFiles({
    name: 'capa.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  await page.getByRole('main').getByRole('button', { name: 'Abrir mesa' }).click();

  await expect(page.getByText('A imagem passa de 2 MB.')).toBeVisible();
  expect(posted).toBe(false);
  await context.close();
});

test('a profile that was only opened is left without asking, even when the form filled in the timezone', async ({
  browser,
}) => {
  // A new person has no timezone: the form offers the browser's, which is not an edit of theirs.
  const { page, context } = await asUser(browser, await createUser('Pessoa Nova'));
  await page.goto('/account/profile');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.getByRole('banner').getByRole('link', { name: 'Mesa Aberta' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await context.close();
});
