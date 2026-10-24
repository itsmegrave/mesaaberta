import { expect, test } from '@playwright/test';
import { PNG, createTable, setFirstSession, signIn, soonSession, uniqueTitle } from './support/app';
import { stack } from './support/stack';
import { createUser, database } from './support/users';

test('duplicates a concluded owned table with its image, a new date and no inherited players', async ({
  page,
}) => {
  const gm = await createUser('Mestra Duplicação');
  await signIn(page, gm);
  const title = uniqueTitle('Fonte concluída');
  const originalSlug = await createTable(page, {
    title,
    image: { name: 'source.png', mimeType: 'image/png', buffer: PNG },
  });
  const db = database();
  try {
    await db`update game_tables set status = 'concluded', min_players = 3, ical_sequence = 8 where slug = ${originalSlug}`;
    await page.goto('/u/tables');
    const card = page.locator(`#mesa-${originalSlug}`);
    await card.getByRole('link', { name: 'Duplicar mesa', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`duplicate=${originalSlug}`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Duplicar mesa');
    await expect(page.getByLabel('Título')).toHaveValue(title);
    await expect(page.locator('input[name="startsAtLocal"]')).toHaveValue('');
    await expect(page.locator('input[name="minPlayers"]')).toHaveValue('3');
    await setFirstSession(page, soonSession());
    await page.getByRole('button', { name: 'Abrir mesa', exact: true }).click();
    await expect(page.getByText('Esta sessão se sobrepõe', { exact: false }).first()).toBeVisible();
    await expect(page.getByLabel('Título')).toHaveValue(title);
    const [day] = soonSession().split('T');
    await setFirstSession(page, `${day}T23:00`);
    await page.getByRole('button', { name: 'Abrir mesa', exact: true }).click();
    await expect(page).toHaveURL(/\/t\/[^/?]+$/);
    const copySlug = new URL(page.url()).pathname.split('/').pop()!;
    expect(copySlug).not.toBe(originalSlug);
    const [source] = await db`select * from game_tables where slug = ${originalSlug}`;
    const [copy] = await db`select * from game_tables where slug = ${copySlug}`;
    expect(source.status).toBe('concluded');
    expect(copy.image_path).toBeTruthy();
    expect(
      (
        await page.request.get(
          `${stack().API_URL}/storage/v1/object/public/table-images/${copy.image_path}`,
        )
      ).ok(),
    ).toBe(true);
    expect(copy).toMatchObject({
      duplicated_from_table_id: source.id,
      image_path: source.image_path,
      min_players: 3,
      ical_sequence: 0,
      status: 'active',
    });
    expect(await db`select player_id from registrations where table_id = ${copy.id}`).toHaveLength(
      0,
    );
    await page.goto(`/t/${originalSlug}/manage`);
    await expect(page.getByRole('link', { name: 'Duplicar mesa', exact: true })).toBeVisible();
  } finally {
    await db.end();
  }
});

test('requires a fresh date in the native form and refuses another owner source', async ({
  page,
  browser,
}) => {
  const gm = await createUser('Mestre Fonte');
  await signIn(page, gm);
  const slug = await createTable(page, { title: uniqueTitle('Fonte privada') });
  await page.goto(`/t/new?duplicate=${slug}`);
  await page.getByRole('button', { name: 'Salvar como rascunho', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`duplicate=${slug}`));
  await expect(page.locator('input[name="startsAtLocal"]')).toHaveValue('');
  const visitor = await browser.newContext();
  try {
    const stranger = await createUser('Mestre Terceiro');
    const otherPage = await visitor.newPage();
    await signIn(otherPage, stranger);
    const response = await otherPage.goto(`/t/new?duplicate=${slug}`);
    expect(response?.status()).toBe(403);
  } finally {
    await visitor.close();
  }
});
