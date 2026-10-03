import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { pickFromSearch, signIn } from './support/app';
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

test('approval submits through native POST when JavaScript is disabled', async ({
  page,
  browser,
}) => {
  const admin = await createUser('Fila Sem JS', { role: 'admin' });
  const name = `Sem JS ${Date.now().toString(36)}`;
  await suggest('tags', [name], admin.id);
  await signIn(page, admin, '/admin/queue');
  const context = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
    baseURL: test.info().project.use.baseURL,
  });
  try {
    const native = await context.newPage();
    await test.step('load the authenticated queue without scripts', async () => {
      await native.goto('/admin/queue', { waitUntil: 'domcontentloaded' });
      await expect(native.getByRole('button', { name: `Aprovar: ${name}` })).toBeVisible();
    });
    await test.step('submit the native approval form', async () => {
      await native.getByRole('button', { name: `Aprovar: ${name}` }).click();
      await expect(native.getByRole('heading', { name, exact: true })).toHaveCount(0);
      await expect(native.getByText(`Aprovação de ${name} (tag)`)).toBeVisible();
    });
  } finally {
    await context.close();
  }
});

test('a refused catalog name stays in the dialog for correction', async ({ page }) => {
  const admin = await createUser('Catálogo Erro', { role: 'admin' });
  await signIn(page, admin, '/admin/catalog');
  await page.getByRole('button', { name: 'Nova plataforma' }).click();
  const field = page.getByLabel('Nome', { exact: true });
  await field.fill('Discord');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(field).toHaveValue('Discord');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await field.fill(`Nova ${Date.now().toString(36)}`);
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('Entrada adicionada.')).toBeVisible();
  await page.getByRole('button', { name: 'Nova plataforma' }).click();
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('');
});

test('switching catalogs creates entries in the selected kind', async ({ page }) => {
  const admin = await createUser('Catálogo Tipo', { role: 'admin' });
  await signIn(page, admin, '/admin/catalog');
  const stamp = Date.now().toString(36);
  for (const [tab, trigger, title, name, expectedKind] of [
    ['Tags', 'Nova tag', 'Nova tag', `Tag ${stamp}`, 'tags'],
    ['Plataformas', 'Nova plataforma', 'Nova plataforma', `Plat ${stamp}`, 'platforms'],
  ]) {
    await page.getByRole('link', { name: tab, exact: true }).click();
    await page.getByRole('button', { name: trigger, exact: true }).click();
    await expect(page.getByRole('dialog').getByText(title, { exact: true })).toBeVisible();
    await page.getByRole('dialog').getByLabel('Nome', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const sql = database();
    try {
      const [tag] = await sql`select id from tags where name = ${name}`;
      const [platform] = await sql`select id from platforms where name = ${name}`;
      expect(Boolean(tag)).toBe(expectedKind === 'tags');
      expect(Boolean(platform)).toBe(expectedKind === 'platforms');
    } finally {
      await sql.end();
    }
  }
});

test('catalog fields and validation fit the viewport in both themes', async ({
  page,
}, testInfo) => {
  const admin = await createUser('Catálogo Visual', { role: 'admin' });
  await signIn(page, admin, '/admin/catalog');
  for (const mode of ['light', 'dark']) {
    await page.evaluate((mode) => {
      document.documentElement.dataset.mode = mode;
    }, mode);
    await page.getByRole('button', { name: 'Nova plataforma' }).click();
    const dialog = page.getByRole('dialog');
    const field = dialog.getByLabel('Nome', { exact: true });
    await expect(field).toBeVisible();
    await dialog.getByRole('button', { name: 'Adicionar' }).click();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toBeFocused();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({ path: testInfo.outputPath(`catalog-dialog-${mode}.png`) });
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
  }
});

test('an admin approves, renames and rejects suggestions, and each decision is logged', async ({
  page,
  isMobile,
}, testInfo) => {
  const gm = await createUser('Mestre Sugestão');
  const admin = await createUser('Fila Admin', { role: 'admin' });
  const tag = `Fila ${Date.now().toString(36)}`;
  await suggest('tags', [`${tag} A`, `${tag} B`, `${tag} C`], gm.id);

  await signIn(page, admin, '/admin/queue');
  await expect(page.getByRole('heading', { name: 'Fila de aprovação', level: 1 })).toBeVisible();
  if (!isMobile) {
    await expect(page.getByRole('link', { name: /^Fila de aprovação/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }

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

test('the catalog lists, searches, pages with ?page=N and merges', async ({
  page,
  isMobile,
}, testInfo) => {
  const gm = await createUser('Mestre Catálogo');
  const admin = await createUser('Catálogo Admin', { role: 'admin' });
  const stamp = Date.now().toString(36);
  const names = Array.from({ length: 22 }, (_, i) => `Cat ${stamp} ${String(i).padStart(2, '0')}`);
  await suggest('platforms', names, gm.id);

  await signIn(page, admin, `/admin/catalog?q=${stamp}`);
  const rows = isMobile ? page.getByTestId('list-rows').locator('> li') : page.locator('tbody tr');
  await expect(rows).toHaveCount(20);
  // A phone has no page numbers: "Mostrar mais" asks for the next size, and the address says so.
  await page
    .getByRole('link', { name: isMobile ? /Mostrar mais/ : 'Próxima página' })
    .locator('visible=true')
    .click();
  await expect(page).toHaveURL(isMobile ? /size=50/ : /page=2/);
  await expect(rows).toHaveCount(isMobile ? 22 : 2);
  expect((await page.goto(`/admin/catalog?q=${stamp}&page=3`))?.status()).toBe(404);
  expect((await page.goto(`/admin/catalog?q=${stamp}&page=abc`))?.status()).toBe(200);

  await page.goto(`/admin/catalog?q=${names[0]}`);
  await page
    .getByRole('button', { name: `Mais ações: ${names[0]}` })
    .locator('visible=true')
    .click();
  await page.getByRole('menuitem', { name: 'Mesclar em outra entrada…' }).click();
  await pickFromSearch(page, 'Mesclar com', 'Discord');
  await page.getByRole('button', { name: 'Mesclar', exact: true }).last().click();
  await expect(page.getByText('Entradas mescladas.')).toBeVisible();
  await expect(page.getByText('Nenhuma entrada encontrada.').locator('visible=true')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('admin-catalog.png'), fullPage: true });

  await page.getByRole('button', { name: 'Nova plataforma' }).click();
  await page.getByLabel('Nome', { exact: true }).fill(`Nova ${stamp}`);
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('Entrada adicionada.')).toBeVisible();
});
