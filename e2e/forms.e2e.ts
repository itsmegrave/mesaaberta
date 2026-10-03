import { expect, test } from '@playwright/test';
import { asUser, homeLink, pickImage } from './support/app';
import { createUser } from './support/users';

test.skip(({ isMobile }) => isMobile, 'signed-in flows run on desktop only');

test('leaving a table form with changes asks first, and staying keeps what was typed', async ({
  browser,
}) => {
  const { page, context } = await asUser(browser, await createUser('Mestra Ana'));
  await page.goto('/tables/new');
  await page.getByLabel('Título').fill('Uma mesa pela metade');

  await homeLink(page).click();

  const dialog = page.getByRole('alertdialog', { name: 'Sair sem salvar?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Continuar editando' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/tables\/new$/);
  await expect(page.getByLabel('Título')).toHaveValue('Uma mesa pela metade');

  await homeLink(page).click();
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

  await pickImage(page, {
    name: 'capa.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  await page.getByRole('main').getByRole('button', { name: 'Abrir mesa' }).click();

  await expect(page.locator('#image-error')).toBeVisible();
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

  await homeLink(page).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await context.close();
});

test('the table form drags the seats, takes an image and a suggestion without a CSP violation', async ({
  browser,
}) => {
  const { page, context } = await asUser(browser, await createUser('Mestra Csp'));
  // Only the form's own: the header's menus have violations of their own, tracked apart.
  await page.addInitScript(() =>
    document.addEventListener('securitypolicyviolation', (event) => {
      if (!(event.target as Element | null)?.closest?.('main')) return;
      ((window as Window & { __violations?: string[] }).__violations ??= []).push(
        `${event.violatedDirective} ${(event.target as Element).outerHTML.slice(0, 120)}`,
      );
    }),
  );
  await page.goto('/tables/new');

  // The thumb is drawn where it can be grabbed, and the arrow keys move it a seat at a time.
  const seats = page.getByRole('slider', { name: 'Vagas' });
  const box = await seats.boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  await seats.focus();
  await page.keyboard.press('ArrowRight');
  await expect(seats).toHaveAttribute('aria-valuenow', '6');
  await expect(page.getByText('6 vagas', { exact: true })).toBeVisible();
  await expect(page.getByRole('complementary').getByText('6 vagas restantes')).toBeVisible();

  await pickImage(page, {
    name: 'capa.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(1024),
  });
  await expect(page.getByRole('button', { name: 'Tirar capa.png' })).toBeVisible();

  // The first session: a day on the calendar (next month, so never in the past), then the hour.
  await page.getByRole('button', { name: 'Próximo mês' }).click();
  await page.getByRole('button', { name: /^Escolher .*, 15 de / }).click();
  await expect(page.locator('input[name="startsAtLocal"]')).toHaveValue(/^\d{4}-\d{2}-15T19:00$/);
  await page.screenshot({ path: 'test-results/date-picker.png' }).catch(() => {});

  await page.getByRole('combobox', { name: 'Tags' }).fill('Mesa de teste');
  await expect(page.getByRole('option', { name: 'Sugerir “Mesa de teste”' })).toBeVisible();

  const reported = await page.evaluate(
    () => (window as Window & { __violations?: string[] }).__violations ?? [],
  );
  expect(reported).toEqual([]);
  await context.close();
});
