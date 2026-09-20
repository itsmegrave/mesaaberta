import { expect, test, type APIRequestContext } from '@playwright/test';

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
		await page.getByRole('link', { name: 'Mesa do Dragão' }).click();

		await expect(page).toHaveURL(/\/tables\/mesa-do-dragao$/);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mesa do Dragão');
	});

	test("shows what a card needs: system, kind, seats and the session in the table's timezone", async ({
		page
	}) => {
		await page.goto('/tables');
		const card = page.getByRole('article').filter({ hasText: 'Mesa do Dragão' });

		await expect(card).toContainText('Dungeons & Dragons 5e (2014)');
		await expect(card).toContainText('One-shot');
		await expect(card).toContainText('5 vagas restantes');
		await expect(card).toContainText(/GMT-3/);
	});

	test('badges a campaign as one, and lists the soonest session first', async ({ page }) => {
		await page.goto('/tables');
		const titles = await page.getByRole('heading', { level: 2 }).allTextContents();

		await expect(page.getByRole('article').filter({ hasText: 'Crônicas de Arton' })).toContainText(
			'Campanha'
		);
		// Crônicas starts in 3 days, the dragon in 7.
		expect(titles.indexOf('Crônicas de Arton')).toBeLessThan(titles.indexOf('Mesa do Dragão'));
	});

	test('never shows a disabled table, in the list or by its address', async ({ page }) => {
		await page.goto('/tables');
		await expect(page.getByText('Mesa Desativada')).toHaveCount(0);

		const response = await page.goto('/tables/mesa-desativada');
		expect(response?.status()).toBe(404);
	});

	test('filters by system, and says so when nothing matches', async ({ page }) => {
		await page.goto('/tables');
		await page.getByLabel('Sistema').selectOption({ label: 'Tormenta 20 (T20)' });
		await page.getByRole('button', { name: 'Filtrar' }).click();

		await expect(page).toHaveURL(/system=tormenta-20-t20/);
		await expect(page.getByRole('link', { name: 'Crônicas de Arton' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Mesa do Dragão' })).toHaveCount(0);

		await page.goto('/tables?system=gurps');
		await expect(page.getByRole('status')).toContainText('Nenhuma mesa aberta neste sistema');
		await expect(page.getByRole('link', { name: 'Ver todas as mesas' })).toHaveAttribute(
			'href',
			'/tables'
		);
	});

	test('does not scroll sideways on a phone', async ({ page }) => {
		await page.goto('/tables');

		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBeLessThanOrEqual(0);
	});
});

test.describe('table page', () => {
	test('shows the description, the GM, the system, the schedule and the extra info', async ({
		page
	}) => {
		await page.goto('/tables/mesa-do-dragao');

		await expect(page.getByText('Uma aventura de uma noite')).toBeVisible();
		await expect(page.getByText('Mestre de Testes')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Dungeons & Dragons 5e (2014)' })).toHaveAttribute(
			'href',
			/\/tables\?system=dungeons-e-dragons-5e-2014$/
		);
		await expect(page.getByText('Sessão única')).toBeVisible();
		await expect(page.getByText('4 h')).toBeVisible();
		await expect(page.getByRole('heading', { level: 2, name: 'Informações extras' })).toBeVisible();
	});

	test('describes a weekly campaign', async ({ page }) => {
		await page.goto('/tables/cronicas-de-arton');

		await expect(page.getByText('Toda semana')).toBeVisible();
		await expect(page.getByText('O mestre aprova cada entrada.')).toBeVisible();
	});

	test('shows user text as text: markup is never interpreted', async ({ page }) => {
		await page.goto('/tables/mesa-do-dragao');

		await expect(page.getByText('Traga dados e <b>lápis</b>.')).toBeVisible();
		await expect(page.locator('article b')).toHaveCount(0);
	});

	test('offers no edit link to a visitor who is not the GM or an admin', async ({ page }) => {
		await page.goto('/tables/mesa-do-dragao');

		await expect(page.getByRole('link', { name: 'Editar mesa' })).toHaveCount(0);
	});

	test('asks an anonymous visitor to sign in to take a seat, and never shows the players', async ({
		page
	}) => {
		await page.goto('/tables/mesa-do-dragao');

		await expect(page.getByRole('link', { name: 'Entre para pegar uma vaga' })).toHaveAttribute(
			'href',
			/^\/login\?next=%2Ftables%2Fmesa-do-dragao$/
		);
		await expect(page.getByRole('button', { name: /pegar vaga|pedir vaga/i })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Jogadores' })).toHaveCount(0);
	});

	test('joining without being signed in sends the visitor to log in and takes no seat', async ({
		request,
		baseURL
	}) => {
		const response = await request.post('/tables/mesa-do-dragao?/join', {
			headers: { origin: baseURL!, accept: 'text/html' },
			form: {},
			maxRedirects: 0
		});

		expect(response.status()).toBe(303);
		expect(response.headers()['location']).toBe('/login?next=%2Ftables%2Fmesa-do-dragao');
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
		await page.goto('/tables/mesa-do-dragao');
		await page.waitForLoadState('networkidle');

		await expect(page).toHaveTitle('Mesa do Dragão');
		expect(violations).toEqual([]);
	});
});
