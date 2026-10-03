import { expect, test } from '@playwright/test';
import { createUser, database } from './support/users';
import { randomUUID } from 'node:crypto';
import { signIn } from './support/app';

test('admin overview is protected, refreshes and fits the viewport', async ({ page }, testInfo) => {
  expect((await page.goto('/admin'))?.status()).toBe(404);
  expect((await page.request.get('/api/query/admin')).status()).toBe(404);

  const member = await createUser('Dashboard Member');
  await signIn(page, member);
  expect((await page.goto('/admin'))?.status()).toBe(404);
  expect((await page.request.get('/api/query/admin')).status()).toBe(404);

  const admin = await createUser('Dashboard Admin', { role: 'admin' });
  await page.context().clearCookies();
  await signIn(page, admin, '/admin');
  await expect(page.getByRole('heading', { name: 'Visão geral da plataforma' })).toBeVisible();
  await expect(page.getByText('Perfis cadastrados', { exact: true })).toBeVisible();
  await expect(page.locator('dt svg')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Pendências operacionais' })).toBeVisible();
  const refreshed = page.waitForResponse((response) => response.url().includes('/api/query/admin'));
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  expect((await refreshed).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Atualizar', exact: true })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Visão geral', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('admin-dashboard.png'), fullPage: true });
  await page.getByRole('link', { name: 'Notificações', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Notificações', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
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
  const users = page.locator('#profiles');
  await expect(users.locator('tbody tr')).toHaveCount(20);
  await expect(users.getByText('Página 1 de 2', { exact: true })).toBeVisible();
  await users.getByRole('button', { name: 'Próxima página' }).click();
  await expect(users.locator('tbody tr')).toHaveCount(4);
  await expect(users.getByText('Página 2 de 2', { exact: true })).toBeVisible();
  await expect(users.getByRole('button', { name: 'Próxima página' })).toBeDisabled();
  await users.getByRole('combobox', { name: 'Status', exact: true }).selectOption('suspended');
  await users.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(users.locator('tbody tr')).toHaveCount(1);
  await expect(users.getByText('Página 1 de 1', { exact: true })).toBeVisible();
  // The list names the person, not their ID; the ID is in the row's menu and on the profile page.
  await expect(users.getByText('Selected User', { exact: true })).toBeVisible();
  // The list shows the profile's status column; the profile page shows the ban (see #172), and this
  // profile was suspended directly in the database, with no ban recorded.
  await expect(users.locator('tbody tr').getByText('Suspenso', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('admin-users.png'), fullPage: true });
  await expect(users.getByRole('link', { name: `@${username}`, exact: true })).toHaveAttribute(
    'href',
    `/u/${username}`,
  );
  await users.getByRole('button', { name: `Mais ações: @${username}` }).click();
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
  await expect(users.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue(
    'suspended',
  );
  await expect(users.getByLabel('Buscar usuário')).toHaveValue(prefix);
  await users.getByLabel('Buscar usuário').fill(`${prefix}-missing`);
  await users.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(users.getByText('Nenhum perfil encontrado.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('admin tables filter and display every real lifecycle status', async ({ page }) => {
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
  const section = page.locator('#tables');
  await section.getByLabel('Buscar mesa pelo título').fill(prefix);
  for (const [status, label] of states) {
    await section.getByRole('combobox', { name: 'Status', exact: true }).selectOption(status);
    await section.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`status=${status}`));
    await expect(section.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue(
      status,
    );
    await expect(section.locator('tbody tr')).toHaveCount(1);
    await expect(section.locator('tbody')).toContainText(`${prefix}-${status}`);
    await expect(section.locator('tbody')).toContainText(label);
  }
});
