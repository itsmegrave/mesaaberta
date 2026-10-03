import { expect, test, type Page } from '@playwright/test';
import { signIn } from './support/app';
import { sidewaysOverflow } from './support/overflow';
import { createUser } from './support/users';

// The rules every page follows (see the redesign card): no page scrolls sideways, every page but the
// home has its breadcrumbs, and none has a "← Voltar" link.

async function followsTheRules(page: Page, path: string, { home = false } = {}) {
  const response = await page.goto(path);
  expect(response?.status(), `${path} answers`).toBeLessThan(400);
  await expect(page.getByRole('main')).toBeVisible();
  expect(await sidewaysOverflow(page), `${path} scrolls sideways`).toBeLessThanOrEqual(0);
  const trail = page.getByRole('navigation', { name: 'Trilha de navegação' });
  if (home) await expect(trail).toHaveCount(0);
  else await expect(trail, `${path} has breadcrumbs`).toHaveCount(1);
  await expect(
    page.getByRole('link', { name: /^(←\s*)?Voltar\b/ }),
    `${path} has a "Voltar" link`,
  ).toHaveCount(0);
}

test('the public pages follow the rules', async ({ page }) => {
  await followsTheRules(page, '/', { home: true });
  for (const path of ['/tables', '/tables/os-sinos-de-sablewood', '/login']) {
    await followsTheRules(page, path);
  }
});

test('the signed-in pages follow the rules', async ({ page }) => {
  const user = await createUser('Regras Gerais');
  await signIn(page, user);
  for (const path of [
    '/account/tables',
    '/account/profile',
    `/u/${user.username}`,
    '/messages',
    '/notifications',
    '/tables/new',
  ]) {
    await followsTheRules(page, path);
  }
});

test('the admin pages follow the rules', async ({ page }) => {
  const admin = await createUser('Regras Admin', { role: 'admin' });
  await signIn(page, admin);
  for (const path of [
    '/admin',
    '/admin/users',
    '/admin/tables',
    '/admin/catalog',
    '/admin/queue',
    '/admin/reports',
    '/admin/audit',
    '/admin/notifications',
  ]) {
    await followsTheRules(page, path);
  }
});
