import { expect, test, type Page } from '@playwright/test';
import {
  chooseFromMenu,
  createTable,
  pickFromSearch,
  setFirstSession,
  soonSession,
  signIn,
  uniqueTitle,
} from './support/app';
import { createUser } from './support/users';

/** Picks several entries from a multi-select, then closes its list. */
async function pickMany(page: Page, label: string, names: string[]) {
  for (const name of names) await pickFromSearch(page, label, name);
  await page.keyboard.press('Escape');
}

// Platforms and tags: the GM picks them, the cards and the table page show them, and the list
// filters by them from the query string.

test('the list filters by platform and by tag, any of the ticked ones, kept in the URL', async ({
  page,
}) => {
  await page.goto('/tables?tag=dungeon-crawl');
  const cards = page.getByRole('article');
  await expect(cards.filter({ hasText: 'A Cripta do Rei Afogado' })).toHaveCount(1);
  await expect(cards.filter({ hasText: 'Os Sinos de Sablewood' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tirar o filtro Dungeon crawl' })).toBeVisible();

  await page.goto('/tables?tag=dungeon-crawl&tag=iniciantes');
  await expect(cards.filter({ hasText: 'A Cripta do Rei Afogado' })).toHaveCount(1);
  await expect(cards.filter({ hasText: 'Os Sinos de Sablewood' })).toHaveCount(1);

  await page.goto('/tables?platform=foundry-vtt');
  await expect(cards.filter({ hasText: 'Os Sinos de Sablewood' })).toHaveCount(1);
  await expect(cards.filter({ hasText: 'Crônicas de Roshar' })).toHaveCount(0);
});

test('ticking a platform applies it at once, and the modality keeps it', async ({
  page,
  isMobile,
}) => {
  await page.goto('/tables');
  // The popover answers once the page has hydrated.
  await page.waitForLoadState('networkidle');
  // A desktop has a box for the platforms; a phone, the "Filtros" sheet with one.
  if (isMobile) await page.getByRole('button', { name: 'Filtros' }).click();
  await page.getByRole('combobox', { name: 'Plataformas' }).last().click();
  await page.getByRole('option', { name: 'Owlbear Rodeo' }).click();
  await expect(page).toHaveURL(/platform=owlbear-rodeo/);
  // Closed, so the list behind it is readable again.
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('article').filter({ hasText: 'A Cripta do Rei Afogado' }),
  ).toHaveCount(1);
  await page
    .getByRole('group', { name: 'Modalidade' })
    .getByRole('button', { name: 'Online' })
    .click();
  await expect(page).toHaveURL(/modality=online/);
  await expect(page).toHaveURL(/platform=owlbear-rodeo/);
});

test('the card and the table page show the platforms and the tags', async ({ page }) => {
  await page.goto('/tables');
  await expect(
    page.getByRole('article').filter({ hasText: 'Os Sinos de Sablewood' }),
  ).toContainText('Discord +1');

  await page.goto('/tables/os-sinos-de-sablewood');
  await expect(
    page.getByRole('list', { name: 'Tags' }).getByRole('link', { name: 'Iniciantes' }),
  ).toHaveAttribute('href', '/tables?tag=iniciantes');
  await expect(page.getByText('Foundry VTT')).toBeVisible();
});

test('a GM picks platforms and tags when opening a table, and edits them later', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'signed-in flows run on desktop only');
  await signIn(page, await createUser('Mestre Catalogo'));
  const title = uniqueTitle('Com tags');

  await page.goto('/tables/new');
  await pickFromSearch(page, 'Sistema de RPG', 'Savage Worlds');
  await page.getByLabel('Título').fill(title);
  await setFirstSession(page, soonSession());
  await pickMany(page, 'Plataformas', ['Roll20']);
  await pickMany(page, 'Tags', ['Terror', 'Humor']);
  await page.getByRole('button', { name: 'Abrir mesa' }).click();

  await expect(page).toHaveURL(/\/tables\/(?!new$)[^/]+$/);
  const tagList = page.getByRole('list', { name: 'Tags' });
  await expect(tagList.getByRole('link', { name: 'Terror' })).toBeVisible();
  await expect(tagList.getByRole('link', { name: 'Humor' })).toBeVisible();

  await chooseFromMenu(page, 'Editar');
  await expect(page.getByRole('button', { name: 'Remover Terror' })).toBeVisible();
  await page.getByRole('button', { name: 'Remover Humor' }).click();
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page).toHaveURL(/\/manage$/);
  await page.goto(page.url().replace(/\/manage$/, ''));
  await expect(
    page.getByRole('list', { name: 'Tags' }).getByRole('link', { name: 'Terror' }),
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Tags' }).getByRole('link', { name: 'Humor' }),
  ).toHaveCount(0);
  void createTable;
});

test('a GM suggests a tag the catalog lacks: it is on the table for them, not for the public', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'signed-in flows run on desktop only');
  await signIn(page, await createUser('Mestre Sugere'));
  const title = uniqueTitle('Sugere tag');
  const suggested = `Bardo ${Math.random().toString(36).slice(2, 7)}`;

  await page.goto('/tables/new');
  await pickFromSearch(page, 'Sistema de RPG', 'Savage Worlds');
  await page.getByLabel('Título').fill(title);
  await setFirstSession(page, soonSession());
  await page.getByRole('combobox', { name: 'Tags' }).fill(suggested);
  await page.getByRole('option', { name: `Sugerir “${suggested}”` }).click();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: `Remover ${suggested} (em análise)` }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Abrir mesa' }).click();

  await expect(page).toHaveURL(/\/tables\/(?!new$)[^/]+$/);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByText(suggested, { exact: true })).toHaveCount(0);

  await chooseFromMenu(page, 'Editar');
  await expect(
    page.getByRole('button', { name: `Remover ${suggested} (em análise)` }),
  ).toBeVisible();
});
