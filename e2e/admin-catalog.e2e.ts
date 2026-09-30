import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { signIn } from './support/app';
import { createUser, database } from './support/users';

const suggest = async (kind: 'platforms' | 'tags', names: string[], by: string) => {
  const sql = database();
  try {
    for (const name of names) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await sql`insert into ${sql(kind)} (id, name, slug, status, suggested_by) values (${randomUUID()}, ${name}, ${slug}, 'pending', ${by})`;
    }
  } finally {
    await sql.end();
  }
};

test('the approval queue and the catalog are for admins only', async ({ page }) => {
  for (const path of ['/admin/queue', '/admin/catalog']) {
    expect((await page.goto(path))?.status()).toBe(404);
  }
  const member = await createUser('Fila Membro');
  await signIn(page, member);
  for (const path of ['/admin/queue', '/admin/catalog']) {
    expect((await page.goto(path))?.status()).toBe(404);
  }
});

test('an admin approves, renames and rejects suggestions, and each decision is logged', async ({
  page,
}, testInfo) => {
  const gm = await createUser('Mestre Sugestão');
  const admin = await createUser('Fila Admin', { role: 'admin' });
  const tag = `Fila ${Date.now().toString(36)}`;
  await suggest('tags', [`${tag} A`, `${tag} B`, `${tag} C`], gm.id);

  await signIn(page, admin, '/admin/queue');
  await expect(page.getByRole('heading', { name: 'Fila de aprovação', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Fila de aprovação' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByRole('button', { name: `Aprovar: ${tag} A` }).click();
  await expect(page.getByText('Sugestão aprovada.')).toBeVisible();
  await expect(page.getByRole('heading', { name: `${tag} A` })).toHaveCount(0);

  await page.getByRole('button', { name: `Renomear: ${tag} B` }).click();
  await page.getByRole('dialog').getByLabel('Novo nome').fill(`${tag} Beta`);
  await page.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(page.getByText('Nome atualizado.')).toBeVisible();
  await expect(page.getByRole('heading', { name: `${tag} Beta` })).toBeVisible();

  await page.getByRole('button', { name: `Recusar: ${tag} C` }).click();
  await expect(page.getByText(`Recusar “${tag} C”?`)).toBeVisible();
  await page.getByRole('button', { name: 'Recusar', exact: true }).click();
  await expect(page.getByText('Sugestão recusada.')).toBeVisible();

  const decisions = page.getByRole('complementary', { name: 'Decisões recentes' });
  await expect(decisions.getByText(`Aprovação de ${tag} A (tag)`)).toBeVisible();
  await expect(decisions.getByText(`Renomeação de ${tag} B para ${tag} Beta (tag)`)).toBeVisible();
  await expect(decisions.getByText(`Recusa de ${tag} C (tag)`)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('admin-queue.png'), fullPage: true });
});

test('the catalog lists, searches, pages with ?page=N and merges', async ({ page }, testInfo) => {
  const gm = await createUser('Mestre Catálogo');
  const admin = await createUser('Catálogo Admin', { role: 'admin' });
  const stamp = Date.now().toString(36);
  const names = Array.from({ length: 22 }, (_, i) => `Cat ${stamp} ${String(i).padStart(2, '0')}`);
  await suggest('platforms', names, gm.id);

  await signIn(page, admin, `/admin/catalog?q=${stamp}`);
  await expect(page.getByText('Página 1 de 2')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(20);
  await page.getByRole('link', { name: 'Próxima página' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  expect((await page.goto(`/admin/catalog?q=${stamp}&page=3`))?.status()).toBe(404);
  expect((await page.goto(`/admin/catalog?q=${stamp}&page=abc`))?.status()).toBe(200);

  await page.goto(`/admin/catalog?q=${names[0]}`);
  await page.getByRole('button', { name: `Mais ações para ${names[0]}` }).click();
  await page.getByRole('button', { name: 'Mesclar', exact: true }).click();
  await page.getByLabel('Mesclar com').selectOption({ label: 'Discord' });
  await page.getByRole('button', { name: 'Mesclar', exact: true }).last().click();
  await expect(page.getByText('Entradas mescladas.')).toBeVisible();
  await expect(page.getByText('Nenhuma entrada encontrada.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('admin-catalog.png'), fullPage: true });

  await page.getByRole('button', { name: 'Nova plataforma' }).click();
  await page.getByLabel('Nome', { exact: true }).fill(`Nova ${stamp}`);
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('Entrada adicionada.')).toBeVisible();
});
