import { expect, test, type APIRequestContext } from '@playwright/test';
import { sidewaysOverflow } from './support/overflow';

// These need the seeded database: `pnpm db:up && pnpm db:migrate && pnpm db:seed` (CI does the same).
// Locally they skip when there is none; in CI a missing database is a failure, not a skip.
const databaseIsUp = async (request: APIRequestContext) =>
  (await (await request.get('/healthz')).json()).database === 'ok';

test.beforeEach(async ({ request }) => {
  test.skip(!process.env.CI && !(await databaseIsUp(request)), 'needs the seeded database');
});

test.describe('table list', () => {
  test('shows a seeded table, and opens its own page', async ({ page }) => {
    await page.goto('/tables');

    await expect(page.getByRole('heading', { level: 1, name: 'Mesas abertas' })).toBeVisible();
    await page.getByRole('link', { name: 'Os Sinos de Sablewood' }).click();

    await expect(page).toHaveURL(/\/tables\/os-sinos-de-sablewood$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Os Sinos de Sablewood');
  });

  test("shows what a card needs: system, kind, seats and the session in the visitor's timezone", async ({
    page,
  }) => {
    await page.goto('/tables');
    const card = page.getByRole('article').filter({ hasText: 'Os Sinos de Sablewood' });

    await expect(card).toContainText('Daggerheart');
    await expect(card).toContainText('One-shot');
    await expect(card).toContainText('5 vagas restantes');
    await expect(card).toContainText(/GMT-3/);
  });

  test('shows where an in-person table plays, and the Old Dragon one is listed too', async ({
    page,
  }) => {
    await page.goto('/tables');

    await expect(page.getByRole('article').filter({ hasText: 'Noites de Neon' })).toContainText(
      'Presencial · Boa Viagem, Recife - PE',
    );
    await expect(
      page.getByRole('article').filter({ hasText: 'A Cripta do Rei Afogado' }),
    ).toContainText('Old Dragon 2ª Edição');
  });

  test('badges a campaign as one, and lists the soonest session first', async ({ page }) => {
    await page.goto('/tables');
    const cards = page.getByRole('article');
    const titles = await cards.evaluateAll((elements) =>
      elements.map((card) => card.querySelector('h2, h3')?.textContent?.trim()),
    );

    await expect(page.getByRole('article').filter({ hasText: 'Crônicas de Roshar' })).toContainText(
      'Campanha',
    );
    // Roshar starts in 3 days, Sablewood in 7.
    expect(titles.indexOf('Crônicas de Roshar')).toBeLessThan(
      titles.indexOf('Os Sinos de Sablewood'),
    );
  });

  test('never shows a disabled table, in the list or by its address', async ({ page }) => {
    await page.goto('/tables');
    await expect(page.getByText('A Última Estrada')).toHaveCount(0);

    const response = await page.goto('/tables/a-ultima-estrada');
    expect(response?.status()).toBe(404);
  });

  test('filters by system, and says so when nothing matches', async ({ page }) => {
    await page.goto('/tables');
    const filter = page.getByRole('combobox', { name: 'Sistema' });
    await expect(filter).toBeVisible();

    // Typed without the accent or the capital, it is still found.
    await filter.fill('cosmere');
    await page.getByRole('option', { name: 'Cosmere Roleplaying Game', exact: true }).click();

    await expect(page).toHaveURL(/system=cosmere-roleplaying-game/);
    const picked = page.getByRole('list', { name: 'Sistema: escolhidos' });
    await expect(
      picked.getByRole('button', { name: 'Remover Cosmere Roleplaying Game' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Crônicas de Roshar' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Os Sinos de Sablewood' })).toHaveCount(0);

    // A second system adds its tables; removing the first leaves only the second's.
    await filter.fill('dagger');
    await page.getByRole('option', { name: 'Daggerheart', exact: true }).click();
    await expect(page).toHaveURL(/system=cosmere-roleplaying-game&system=daggerheart/);
    await expect(page.getByRole('link', { name: 'Os Sinos de Sablewood' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Crônicas de Roshar' })).toBeVisible();

    // The list stays open for another pick; Escape closes it.
    await filter.press('Escape');
    await picked.getByRole('button', { name: 'Remover Cosmere Roleplaying Game' }).click();
    await expect(page).toHaveURL(/\?system=daggerheart$/);
    await expect(page.getByRole('link', { name: 'Crônicas de Roshar' })).toHaveCount(0);

    await page.goto('/tables?system=gurps');
    await expect(page.getByRole('status')).toContainText('Nenhuma mesa aberta com esses filtros');
    await expect(page.getByRole('link', { name: 'Ver todas as mesas' })).toHaveAttribute(
      'href',
      '/tables',
    );
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('filters by system with the plain list and the Filtrar button', async ({ page }) => {
      await page.goto('/tables');

      await page.getByLabel('Sistema', { exact: true }).selectOption('cosmere-roleplaying-game');
      await page.getByRole('button', { name: 'Filtrar' }).click();

      await expect(page).toHaveURL(/\?system=cosmere-roleplaying-game$/);
      await expect(page.getByRole('link', { name: 'Crônicas de Roshar' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Os Sinos de Sablewood' })).toHaveCount(0);
    });
  });

  test('does not scroll sideways on a phone', async ({ page }) => {
    await page.goto('/tables');

    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe("times in the visitor's timezone", () => {
  test('a visitor in Brazil sees the session in their zone', async ({ page }) => {
    await page.goto('/tables/os-sinos-de-sablewood');
    await expect(page.getByRole('main')).toContainText('GMT-3');
  });

  test.describe('in Tokyo', () => {
    test.use({ timezoneId: 'Asia/Tokyo' });

    test('sees the same session in Tokyo time, from the browser', async ({ page }) => {
      await page.goto('/tables/os-sinos-de-sablewood');
      await expect(page.getByRole('main')).toContainText('GMT+9');
      await expect(page.getByRole('main')).not.toContainText('GMT-3');
    });
  });
});

test.describe('table page', () => {
  test('shows where it sits: a trail with the table’s name on wide screens, a back link on phones', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/tables/os-sinos-de-sablewood');
    const trail = page.getByRole('navigation', { name: 'Trilha de navegação' });

    if (isMobile) {
      await expect(trail).toBeHidden();
      await expect(page.getByRole('link', { name: 'Voltar para as mesas' })).toBeVisible();
      return;
    }
    await expect(page.getByRole('link', { name: 'Voltar para as mesas' })).toBeHidden();
    await expect(trail.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/');
    await expect(trail.getByRole('link', { name: 'Mesas' })).toHaveAttribute('href', '/tables');
    await expect(trail.getByText('Os Sinos de Sablewood')).toHaveAttribute('aria-current', 'page');
  });

  test('shows the description, the GM, the system, the schedule and the extra info', async ({
    page,
  }) => {
    await page.goto('/tables/os-sinos-de-sablewood');

    await expect(page.getByText('Uma aventura de uma noite')).toBeVisible();
    await expect(page.getByText('@mestre-de-testes')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Daggerheart' })).toHaveAttribute(
      'href',
      /\/tables\?system=daggerheart$/,
    );
    await expect(page.getByText('Sessão única')).toBeVisible();
    await expect(page.getByText('4 horas')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Informações extras' })).toBeVisible();
  });

  test('describes a weekly campaign', async ({ page }) => {
    await page.goto('/tables/cronicas-de-roshar');

    await expect(page.getByText('Toda semana')).toBeVisible();
    await expect(page.getByText('Cada entrada passa por aprovação.')).toBeVisible();
  });

  test('shows rich text with its formatting and never runs what is stored with it', async ({
    page,
  }) => {
    await page.goto('/tables/os-sinos-de-sablewood');

    await expect(page.getByText('Traga dados e lápis.')).toBeVisible();
    await expect(page.locator('.rich-text strong', { hasText: 'lápis' })).toBeVisible();
    await expect(page.locator('.rich-text script')).toHaveCount(0);
    expect(await page.evaluate(() => (window as { __xss?: boolean }).__xss)).toBeUndefined();
  });

  test('offers no edit link to a visitor who is not the GM or an admin', async ({ page }) => {
    await page.goto('/tables/os-sinos-de-sablewood');

    await expect(page.getByRole('link', { name: 'Editar mesa' })).toHaveCount(0);
  });

  test('asks an anonymous visitor to sign in to take a seat, and never shows the players', async ({
    page,
  }) => {
    await page.goto('/tables/os-sinos-de-sablewood');

    await expect(page.getByRole('link', { name: 'Entre para pegar uma vaga' })).toHaveAttribute(
      'href',
      /^\/login\?next=%2Ftables%2Fos-sinos-de-sablewood$/,
    );
    await expect(page.getByRole('button', { name: /pegar vaga|pedir vaga/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Participantes' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Avalie a mestragem' })).toHaveCount(0);
  });

  test('joining without being signed in sends the visitor to log in and takes no seat', async ({
    request,
    baseURL,
  }) => {
    const response = await request.post('/tables/os-sinos-de-sablewood?/join', {
      headers: { origin: baseURL!, accept: 'text/html' },
      form: {},
      maxRedirects: 0,
    });

    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toBe('/login?next=%2Ftables%2Fos-sinos-de-sablewood');
  });

  test('an unknown slug is the translated 404, with a way back', async ({ page }) => {
    const response = await page.goto('/tables/nao-existe');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/não encontrada/i);
    await expect(page.getByRole('link', { name: /voltar/i })).toBeVisible();
  });

  test('has a title, and no CSP violation on either page', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      if (/content security policy/i.test(message.text())) violations.push(message.text());
    });

    await page.goto('/tables');
    await page.goto('/tables/os-sinos-de-sablewood');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle('Os Sinos de Sablewood');
    expect(violations).toEqual([]);
  });
});
