import { expect, test } from '@playwright/test';
import { createUser } from './support/users';
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('admin-dashboard.png'), fullPage: true });
});
