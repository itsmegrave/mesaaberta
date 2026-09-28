import { expect, test } from '@playwright/test';
import { createTable, signIn, uniqueTitle, pickFromSearch } from './support/app';
import { createUser } from './support/users';

// Platforms and tags: the GM picks them, the cards and the table page show them, and the list
// filters by them from the query string.

test('the list filters by platform and by tag, any of the ticked ones, kept in the URL', async ({
  page,
}) => {
  await page.goto('/tables?tag=dungeon-crawl');
  const cards = page.getByRole('article');
  await expect(cards.filter({ hasText: 'A Cripta do Rei Afogado' })).toHaveCount(1);
  await expect(cards.filter({ hasText: 'Os Sinos de Sablewood' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Tags' }).getByLabel('Dungeon crawl')).toBeChecked();

  await page.goto('/tables?tag=dungeon-crawl&tag=iniciantes');
  await expect(cards.filter({ hasText: 'A Cripta do Rei Afogado' })).toHaveCount(1);
  await expect(cards.filter({ hasText: 'Os Sinos de Sablewood' })).toHaveCount(1);

  await page.goto('/tables?platform=foundry-vtt');
  await expect(cards.filter({ hasText: 'Os Sinos de Sablewood' })).toHaveCount(1);
  await expect(cards.filter({ hasText: 'Crônicas de Roshar' })).toHaveCount(0);
});

test('ticking a chip applies it at once, and the system filter keeps it', async ({ page }) => {
  await page.goto('/tables');
  await page.getByRole('group', { name: 'Plataformas' }).getByText('Owlbear Rodeo').click();
  await expect(page).toHaveURL(/platform=owlbear-rodeo/);
  await expect(
    page.getByRole('article').filter({ hasText: 'A Cripta do Rei Afogado' }),
  ).toHaveCount(1);

  await page
    .getByRole('group', { name: 'Modalidade' })
    .getByRole('link', { name: 'Online' })
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
  await page.getByLabel('Primeira sessão').fill('2099-06-01T19:00');
  await page.getByRole('group', { name: 'Plataformas' }).getByText('Roll20').click();
  await page.getByRole('group', { name: 'Tags' }).getByText('Terror').click();
  await page.getByRole('group', { name: 'Tags' }).getByText('Humor').click();
  await page.getByRole('button', { name: 'Abrir mesa' }).click();

  await expect(page).toHaveURL(/\/tables\/(?!new$)[^/]+$/);
  const tagList = page.getByRole('list', { name: 'Tags' });
  await expect(tagList.getByRole('link', { name: 'Terror' })).toBeVisible();
  await expect(tagList.getByRole('link', { name: 'Humor' })).toBeVisible();

  await page.getByRole('link', { name: 'Editar mesa' }).click();
  await expect(page.getByRole('group', { name: 'Tags' }).getByLabel('Terror')).toBeChecked();
  await page.getByRole('group', { name: 'Tags' }).getByText('Humor').click();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(
    page.getByRole('list', { name: 'Tags' }).getByRole('link', { name: 'Humor' }),
  ).toHaveCount(0);
  void createTable;
});
