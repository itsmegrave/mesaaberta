import { expect, test } from '@playwright/test';
import { signIn } from './support/app';
import { createUser } from './support/users';

test.describe('canonical resource URLs', () => {
  for (const [legacy, canonical] of [
    [
      '/en/tables/dragon/manage?status=active&page=2&tag=a%2Fb',
      '/t/dragon/manage?status=active&page=2&tag=a%2Fb',
    ],
    ['/partners/42/edit', '/p/42/edit'],
    ['/crowdfunding/new', '/cf/new'],
    ['/messages/42?page=2', '/m/42?page=2'],
    ['/notifications?category=table', '/n?category=table'],
    ['/account/tables/calendar', '/u/tables/calendar'],
    ['/account/profile', '/u/profile/edit'],
    ['/account/export', '/u/profile/export'],
    ['/account/connect/google', '/u/profile/connect/google'],
    ['/onboarding?next=%2Ftables%2Fnew', '/u/profile/setup?next=%2Ftables%2Fnew'],
    ['/forgot-password', '/forgot'],
    ['/reset-password', '/reset'],
  ]) {
    test(`permanently redirects the full legacy URL ${legacy}`, async ({ request }) => {
      for (const method of ['GET', 'HEAD']) {
        const response = await request.fetch(legacy, { method, maxRedirects: 0 });
        expect(response.status()).toBe(308);
        expect(response.headers().location).toBe(canonical);
      }
    });
  }

  test('preserves the hidden admin boundary through legacy locale aliases', async ({ request }) => {
    const response = await request.get('/en/admin/tables', { maxRedirects: 0 });
    expect(response.status()).toBe(404);
  });

  test('keeps pagination and fragments when an old bookmark opens in the browser', async ({
    page,
  }) => {
    await page.goto('/en/partners?page=1#how-it-works');
    await expect(page).toHaveURL(/\/p\?page=1#how-it-works$/);
  });

  test('keeps profiles public while private account leaves require sign-in', async ({
    page,
    request,
  }) => {
    const user = await createUser('Public Routing');
    const profile = await request.get(`/u/${user.username}`, { maxRedirects: 0 });
    expect(profile.status()).toBe(200);
    for (const path of [
      '/u/tables',
      '/u/tables/calendar',
      '/u/profile/edit',
      '/u/profile/export',
    ]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(303);
      expect(response.headers().location).toBe(`/login?next=${encodeURIComponent(path)}`);
    }
    await page.goto(`/u/${user.username}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', page.url());
  });

  test('validates legacy native POST bodies at the same canonical actions', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'signed-in flows run on desktop only');
    const user = await createUser('Legacy Actions');
    await signIn(page, user, '/t/new');
    const headers = { origin: new URL(page.url()).origin, accept: 'text/html' };
    const table = await page.request.post('/tables/new', {
      headers,
      form: { title: 'Title from an old form' },
      maxRedirects: 0,
    });
    expect(table.status()).toBe(400);
    expect(await table.text()).toContain('Title from an old form');

    const profile = await page.request.post('/account/profile?/save', {
      headers,
      form: { name: user.name, username: `${user.username}!`, city: 'City from an old form' },
      maxRedirects: 0,
    });
    expect(profile.status()).toBe(400);
    expect(await profile.text()).toContain('City from an old form');
  });
});
