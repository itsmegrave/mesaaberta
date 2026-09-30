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
