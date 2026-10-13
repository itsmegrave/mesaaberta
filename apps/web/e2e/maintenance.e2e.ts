import { expect, test } from '@playwright/test';
import { signIn } from './support/app';
import { PASSWORD, createUser } from './support/users';

// Runs against the second server, started with the `maintenance_mode` flag on (playwright.config.ts).

const SCREEN_TITLE = 'Voltamos em breve';

test.describe('maintenance mode', () => {
  test('every page shows the maintenance screen with a 503, and nothing of the product', async ({
    page,
  }) => {
    for (const path of ['/', '/tables', '/signup', '/account/tables']) {
      const response = await page.goto(path);

      expect(response?.status(), path).toBe(503);
      expect(response?.headers()['retry-after'], path).toBe('3600');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(SCREEN_TITLE);
      await expect(page.getByRole('navigation')).toHaveCount(0);
      // Served at the address asked for, not redirected.
      expect(new URL(page.url()).pathname).toBe(path);
    }
  });

  test('a form post is refused without running', async ({ request, baseURL }) => {
    // Same-origin, as a browser sends it; otherwise SvelteKit's CSRF check answers first.
    const response = await request.post('/tables/new', {
      form: { title: 'x' },
      headers: { origin: baseURL! },
    });

    expect(response.status()).toBe(503);
    expect(await response.text()).toContain('em manutenção');
  });

  test('the uptime check still answers', async ({ request }) => {
    expect((await request.get('/healthz')).status()).toBe(200);
  });

  test('a member who signs in still gets the screen', async ({ page }) => {
    const member = await createUser('Pessoa Comum');

    await page.goto('/login');
    await page.getByLabel('Email').fill(member.email);
    await page.getByLabel('Senha').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(SCREEN_TITLE);
  });

  test('an admin signs in and uses the site, with a banner saying it is down for everyone else', async ({
    page,
  }) => {
    const admin = await createUser('Admin Manutenção', { role: 'admin' });
    await signIn(page, admin, '/tables');

    await expect(
      page.getByText('Modo de manutenção ativo: só a administração vê o site.'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(SCREEN_TITLE);
  });
});
