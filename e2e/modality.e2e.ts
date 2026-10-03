import { expect, test } from '@playwright/test';
import {
  createTable,
  pickFromSearch,
  setFirstSession,
  soonSession,
  setSeats,
  signIn,
  uniqueTitle,
} from './support/app';
import { createUser, database } from './support/users';

// Online or in person: the GM says which, players see it and can filter by it, and the address or
// link stays private to the GM and the confirmed players.
test.skip(({ isMobile }) => isMobile, 'signed-in flows run on desktop only');

test('an in-person table shows its area to everyone and its address only to the GM', async ({
  page,
  browser,
}) => {
  const gm = await createUser('Mestre Presencial');
  await signIn(page, gm);
  const title = uniqueTitle('Presencial');
  const slug = await createTable(page, {
    title,
    inPerson: { area: 'Boa Viagem, Recife', address: 'Rua das Flores, 10' },
  });

  await expect(page.getByText('Presencial · Boa Viagem, Recife')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Como entrar' })).toBeVisible();
  await expect(page.getByText('Rua das Flores, 10')).toBeVisible();

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/tables/${slug}`);
  await expect(visitor.getByText('Presencial · Boa Viagem, Recife')).toBeVisible();
  await expect(visitor.getByText('Rua das Flores')).toHaveCount(0);

  await visitor.goto('/tables?modality=in_person');
  await expect(
    visitor.getByRole('group', { name: 'Modalidade' }).getByRole('button', { name: 'Presencial' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(visitor.getByRole('article').filter({ hasText: title })).toContainText(
    'Presencial · Boa Viagem, Recife',
  );

  await visitor.goto('/tables?modality=online');
  await expect(visitor.getByRole('article').filter({ hasText: title })).toHaveCount(0);
});

test('an in-person table needs the neighbourhood and city', async ({ page }) => {
  await signIn(page, await createUser('Mestre Sem Bairro'));
  await page.goto('/tables/new');
  await page.getByLabel('Presencial', { exact: true }).check();
  await expect(page.getByLabel('Bairro e cidade')).toBeVisible();
  await page.getByLabel('Online', { exact: true }).check();
  await expect(page.getByLabel('Bairro e cidade')).toHaveCount(0);
});

test('a CEP fills the neighbourhood and city in, from the local cache, and never shows the CEP', async ({
  page,
}) => {
  // Cached, so the test never calls ViaCEP.
  const sql = database();
  try {
    await sql`insert into postal_codes (cep, neighbourhood, city, state) values ('52011000', 'Graças', 'Recife', 'PE') on conflict do nothing`;
  } finally {
    await sql.end();
  }

  await signIn(page, await createUser('Mestre Com Cep'));
  await page.goto('/tables/new');
  await pickFromSearch(page, 'Sistema de RPG', 'Daggerheart');
  await page.getByLabel('Título').fill(uniqueTitle('Com CEP'));
  await setSeats(page, 4);
  await setFirstSession(page, soonSession());
  await page.getByLabel('Presencial', { exact: true }).check();
  await page.getByLabel('CEP', { exact: true }).fill('52011-000');
  await page.getByRole('button', { name: 'Abrir mesa' }).click();

  await expect(page).toHaveURL(/\/tables\/(?!new$)[^/]+$/);
  await expect(page.getByText('Presencial · Graças, Recife - PE')).toBeVisible();
  await expect(page.getByText('52011')).toHaveCount(0);
});

test('a CEP in the wrong shape is refused next to the field', async ({ page }) => {
  await signIn(page, await createUser('Mestre Cep Errado'));
  await page.goto('/tables/new');
  await pickFromSearch(page, 'Sistema de RPG', 'Daggerheart');
  await page.getByLabel('Título').fill(uniqueTitle('CEP ruim'));
  await setFirstSession(page, soonSession());
  await page.getByLabel('Presencial', { exact: true }).check();
  await page.getByLabel('CEP', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Abrir mesa' }).click();

  await expect(page.locator('#postalCode-error')).toBeVisible();
});
