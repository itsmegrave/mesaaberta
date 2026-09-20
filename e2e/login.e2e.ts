import { expect, test } from '@playwright/test';

// CI has no Supabase settings, so these cover the app as it runs before login is configured.
test.describe('login while Supabase is not configured', () => {
	test('the login page says so and offers no provider buttons', async ({ page }) => {
		await page.goto('/login');

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrar');
		await expect(page.getByText(/ainda não está disponível/i)).toBeVisible();
		await expect(page.getByRole('link', { name: /continuar com/i })).toHaveCount(0);
	});

	test('the sign-up page says so too, and a post to it goes back to the login page', async ({
		page,
		request,
		baseURL
	}) => {
		await page.goto('/signup');

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Criar conta');
		await expect(page.getByText(/ainda não está disponível/i)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Criar conta' })).toHaveCount(0);

		const response = await request.post('/signup', {
			headers: { origin: baseURL!, accept: 'text/html' },
			form: { email: 'ana@example.com', password: 'correct horse' },
			maxRedirects: 0
		});
		expect(response.status()).toBe(303);
		expect(response.headers()['location']).toBe('/login?error=unavailable');
	});

	test('the forgot-password page says so, and a post to it goes back to the login page', async ({
		page,
		request,
		baseURL
	}) => {
		await page.goto('/forgot-password');

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Esqueci minha senha');
		await expect(page.getByText(/ainda não está disponível/i)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Enviar link' })).toHaveCount(0);

		const response = await request.post('/forgot-password', {
			headers: { origin: baseURL!, accept: 'text/html' },
			form: { email: 'ana@example.com' },
			maxRedirects: 0
		});
		expect(response.status()).toBe(303);
		expect(response.headers()['location']).toBe('/login?error=unavailable');
	});

	test('the new-password page needs the session a recovery link gives: without one it asks for a new link', async ({
		request,
		baseURL
	}) => {
		const page = await request.get('/reset-password', { maxRedirects: 0 });
		const post = await request.post('/reset-password', {
			headers: { origin: baseURL!, accept: 'text/html' },
			form: { password: 'a brand new password', passwordConfirm: 'a brand new password' },
			maxRedirects: 0
		});

		for (const response of [page, post]) {
			expect(response.status()).toBe(303);
			expect(response.headers()['location']).toBe('/forgot-password?error=link');
		}
	});

	test('the header has no sign-in link, so nobody is sent to a dead end', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('banner').getByRole('link', { name: 'Entrar' })).toHaveCount(0);
	});

	test('starting a login or returning from one goes back to the login page with an error', async ({
		request
	}) => {
		for (const path of ['/login/google', '/auth/callback?code=abc']) {
			const response = await request.get(path, { maxRedirects: 0 });

			expect(response.status()).toBe(303);
			expect(response.headers()['location']).toBe('/login?error=unavailable');
		}
	});

	test('an error flag shows a fixed message and never echoes the parameter', async ({ page }) => {
		await page.goto('/login?error=<img src=x onerror=alert(1)>');

		await expect(page.getByRole('alert')).toHaveText(/não foi possível entrar/i);
		await expect(page.locator('img[src="x"]')).toHaveCount(0);
	});

	test('a provider that is not on the list is a 404', async ({ request }) => {
		const response = await request.get('/login/myspace', { maxRedirects: 0 });

		expect(response.status()).toBe(404);
	});

	test('signing out is a POST that lands on the home page, and a GET is refused', async ({
		request,
		baseURL
	}) => {
		const post = await request.post('/logout', {
			headers: { origin: baseURL! },
			form: {},
			maxRedirects: 0
		});
		const get = await request.get('/logout', { maxRedirects: 0 });

		expect(post.status()).toBe(303);
		expect(post.headers()['location']).toBe('/');
		expect(get.status()).toBe(405);
	});

	test('the login page renders without CSP violations', async ({ page }) => {
		const violations: string[] = [];
		page.on('console', (message) => {
			if (/content security policy/i.test(message.text())) violations.push(message.text());
		});

		await page.goto('/login');
		await page.waitForLoadState('networkidle');

		expect(violations).toEqual([]);
	});
});
