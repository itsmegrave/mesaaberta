import { expect, test } from '@playwright/test';
import { pickFromSearch, setFirstSession, signIn, soonSession, uniqueTitle } from './support/app';
import { createUser, database } from './support/users';

// The dialog's focus, Escape and native action contract are also covered by browser component tests.
test('the owner permanently deletes a draft after confirming and cancellation leaves it untouched', async ({
  page,
}) => {
  const gm = await createUser('Mestre Rascunho');
  await signIn(page, gm);
  await page.goto('/t/new');
  await pickFromSearch(page, 'Sistema de RPG', 'Daggerheart');
  const title = uniqueTitle('Rascunho descartado');
  await page.getByLabel('Título').fill(title);
  await setFirstSession(page, soonSession());
  await page.getByRole('button', { name: 'Salvar como rascunho', exact: true }).click();
  await expect(page).toHaveURL(/\/t\/[^/]+\/manage$/);
  const slug = new URL(page.url()).pathname.split('/').at(-2)!;
  await page.goto('/u/tables');
  const card = page.locator(`#mesa-${slug}`);
  const endFromMenu = async () => {
    await card.getByRole('button', { name: /^Mais ações:/ }).click();
    await page.getByRole('menuitem', { name: 'Excluir rascunho…' }).click();
  };
  await endFromMenu();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await expect(dialog).toContainText('Esta ação não pode ser desfeita.');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(card).toBeVisible();
  await endFromMenu();
  await dialog.getByRole('button', { name: 'Excluir rascunho', exact: true }).click();
  await expect(card).toHaveCount(0);
  const db = database();
  try {
    expect(await db`select id from game_tables where slug = ${slug}`).toHaveLength(0);
  } finally {
    await db.end();
  }
  const response = await page.goto(`/t/${slug}`);
  expect(response?.status()).toBe(404);
});
