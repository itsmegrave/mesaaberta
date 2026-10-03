import { expect, test, type Locator, type Page } from '@playwright/test';
import { createUser, database } from './support/users';
import { randomUUID } from 'node:crypto';
import { adminSection, signIn } from './support/app';

// A list is a table on a desktop and a list of cards on a phone: the rows of the one that shows.
const listRows = (page: Page, isMobile: boolean) =>
  isMobile ? page.getByTestId('list-rows').locator('> li') : page.locator('tbody tr');
// The filter and the search are drawn once for each screen size; the one that shows is the one used.
const shown = (locator: Locator) => locator.locator('visible=true');
// A segment of the filter is a radio hidden behind its label; the one of the screen size that
// shows is the only one in the accessibility tree.
const segment = (page: Page, name: string) =>
  page.getByRole('radio', { name: new RegExp(`^${name}`) });

test('admin overview is protected, refreshes and fits the viewport', async ({
  page,
  isMobile,
}, testInfo) => {
  expect((await page.goto('/admin'))?.status()).toBe(404);
  expect((await page.request.get('/api/query/admin')).status()).toBe(404);

  const member = await createUser('Dashboard Member');
  await signIn(page, member);
  expect((await page.goto('/admin'))?.status()).toBe(404);
  expect((await page.request.get('/api/query/admin')).status()).toBe(404);

  const admin = await createUser('Dashboard Admin', { role: 'admin' });
  await page.context().clearCookies();
  await signIn(page, admin, '/admin');
  await expect(page.getByRole('heading', { name: 'Visão geral', level: 1 })).toBeVisible();
  await expect(page.getByText('Perfis cadastrados', { exact: true })).toBeVisible();
  await expect(page.locator('dt svg')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Operação' })).toBeVisible();
  const refreshed = page.waitForResponse((response) => response.url().includes('/api/query/admin'));
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  expect((await refreshed).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Atualizar', exact: true })).toBeEnabled();
  if (!isMobile) {
    await expect(await adminSection(page, false, 'Visão geral')).toHaveAttribute(
      'aria-current',
      'page',
    );
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('admin-dashboard.png'), fullPage: true });
  await (await adminSection(page, isMobile, 'Notificações')).click();
  await expect(page.getByRole('heading', { name: 'Notificações', level: 1 })).toBeVisible();
  const icons = page.locator('input[name="icon"]');
  await expect(icons).toHaveCount(7);
  const drawings = await icons.evaluateAll((inputs) =>
    inputs.map((input) => input.closest('label')!.querySelector('svg')!.innerHTML),
  );
  expect(new Set(drawings.slice(1)).size).toBe(6);
  expect(drawings[0]).toBe(drawings[6]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('admin-notifications.png'), fullPage: true });
});

test('users table paginates, filters status and username, and links to the selected profile', async ({
  page,
  isMobile,
}, testInfo) => {
  const admin = await createUser('Users Admin', { role: 'admin' });
  const prefix = `users-${Date.now().toString(36)}`;
  const userId = randomUUID();
  const username = `${prefix}-suspended`;
  const db = database();
  try {
    await db`insert into profiles (id, username, status, name) values (${userId}, ${username}, 'suspended', 'Selected User')`;
    for (let index = 0; index < 23; index++) {
      await db`insert into profiles (id, username) values (${randomUUID()}, ${`${prefix}-${String(index).padStart(2, '0')}`})`;
    }
  } finally {
    await db.end();
  }
  expect((await page.goto(`/admin/users/${userId}`))?.status()).toBe(404);
  await signIn(page, admin, `/admin/users?q=${prefix}`);
  const rows = listRows(page, isMobile);
  await expect(rows).toHaveCount(20);
  if (isMobile) {
    // A phone has no pages: "Mostrar mais" asks for the next size.
    await page.getByRole('link', { name: /Mostrar mais/ }).click();
    await expect(page).toHaveURL(/size=50/);
    await expect(rows).toHaveCount(24);
  } else {
    await expect(page.getByText('1–20 de 24 usuários')).toBeVisible();
    await page.getByRole('link', { name: 'Próxima página' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(rows).toHaveCount(4);
    await expect(page.getByText('21–24 de 24 usuários')).toBeVisible();
  }
  await segment(page, 'Suspenso').check({ force: true });
  await expect(page).toHaveURL(/status=suspended/);
  await expect(rows).toHaveCount(1);
  // The list names the person, not their ID; the ID is in the row's menu and on the profile page.
  await expect(
    page.getByText('Selected User', { exact: true }).locator('visible=true'),
  ).toBeVisible();
  // The list shows the profile's status; the profile page shows the ban (see #172), and this
  // profile was suspended directly in the database, with no ban recorded.
  await expect(rows.getByText('Suspenso', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('admin-users.png'), fullPage: true });
  await expect(
    shown(page.getByRole('link', { name: `@${username}`, exact: true })).first(),
  ).toHaveAttribute('href', `/u/${username}`);
  await shown(page.getByRole('button', { name: `Mais ações: @${username}` })).click();
  await page.getByRole('menuitem', { name: 'Ver detalhes' }).click();
  await expect(page.getByRole('heading', { name: `@${username}` })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Dados' }).getByText(userId)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('admin-user-profile.png'), fullPage: true });
  const trail = page.getByRole('navigation', { name: 'Trilha de navegação' });
  if (isMobile) {
    // A phone folds the middle of a trail over three levels into a "…" menu.
    await trail.getByRole('button', { name: 'Mostrar os níveis do meio' }).click();
    await page.getByRole('menuitem', { name: 'Usuários' }).click();
  } else {
    await trail.getByRole('link', { name: 'Usuários' }).click();
  }
  // Back on the list, the filters are as they were left.
  await expect(page).toHaveURL(/status=suspended/);
  await expect(shown(page.getByLabel('Buscar usuário'))).toHaveValue(prefix);
  await shown(page.getByLabel('Buscar usuário')).fill(`${prefix}-missing`);
  await expect(page.getByText('Nenhum perfil encontrado.').locator('visible=true')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('admin tables filter and display every real lifecycle status', async ({ page, isMobile }) => {
  const admin = await createUser('Lifecycle Admin', { role: 'admin' });
  const prefix = `lifecycle-${randomUUID().slice(0, 8)}`;
  const states = [
    ['active', 'Ativa'],
    ['disabled', 'Desativada'],
    ['awaiting_confirmation', 'Aguardando confirmação'],
    ['concluded', 'Concluída'],
    ['not_held', 'Não realizada'],
  ] as const;
  const sql = database();
  try {
    for (const [status] of states) {
      await sql`insert into game_tables (slug, title, system_id, gm_id, kind, capacity, starts_at, duration_minutes, timezone, status) values (${`${prefix}-${status}`}, ${`${prefix}-${status}`}, (select id from systems where slug = 'daggerheart'), ${admin.id}, 'one_shot', 4, ${new Date('2099-01-01')}, 180, 'America/Sao_Paulo', ${status})`;
    }
  } finally {
    await sql.end();
  }
  await signIn(page, admin, '/admin/tables');
  const rows = listRows(page, isMobile);
  await shown(page.getByLabel('Buscar mesa, sistema ou @mestre')).fill(prefix);
  for (const [status, label] of states) {
    // On a phone the status filter is in the "Filtros" sheet.
    if (isMobile && !(await segment(page, label).isVisible()))
      await page.getByRole('button', { name: /^Filtros/ }).click();
    await segment(page, label).check({ force: true });
    await expect(page).toHaveURL(new RegExp(`status=${status}`));
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText(`${prefix}-${status}`);
    await expect(rows).toContainText(label);
  }
});
