import { expect, test } from '@playwright/test';

// Against the local Supabase: the real login screens, and the hop to a provider.
test.describe('the login page', () => {
	test('offers email and password, both providers, and a way to sign up or reset a password', async ({
		page
	}) => {
		await page.goto('/login');

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrar');
		await expect(page.getByLabel('Email')).toBeVisible();
		await expect(page.getByLabel('Senha')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Continuar com Google' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Continuar com Discord' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute(
			'href',
			/forgot-password$/
		);
		await expect(page.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', /signup/);
	});

	test('offers no provider that is not set up', async ({ page }) => {
		await page.goto('/login');

		// Only in the main area: the footer has its own GitHub link, to the code.
		await expect(
			page.getByRole('main').getByRole('link', { name: /Apple|Facebook|GitHub/ })
		).toHaveCount(0);
	});

	test('the sign-up and forgot-password pages have their forms', async ({ page }) => {
		await page.goto('/signup');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Criar conta');
		await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible();

		await page.goto('/forgot-password');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Esqueci minha senha');
		await expect(page.getByRole('button', { name: 'Enviar link' })).toBeVisible();
	});

	test('the header does not offer a way in while the platform is unreleased', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('banner').getByRole('link', { name: 'Entrar' })).toHaveCount(0);
	});

	for (const [provider, host, clientId] of [
		['google', 'accounts.google.com', 'e2e-google-client-id'],
		['discord', 'discord.com', 'e2e-discord-client-id']
	]) {
		test(`${provider}: our app hands off to Auth, and Auth to the provider, coming back to our callback`, async ({
			request
		}) => {
			const ours = await request.get(`/login/${provider}?next=%2Ftables%2Fnew`, {
				maxRedirects: 0
			});
			expect(ours.status()).toBe(303);
			const auth = new URL(ours.headers()['location']);
			expect(auth.pathname).toBe('/auth/v1/authorize');
			expect(auth.searchParams.get('provider')).toBe(provider);
			expect(auth.searchParams.get('redirect_to')).toMatch(
				/\/auth\/callback\?next=%2Ftables%2Fnew$/
			);
			expect(auth.searchParams.get('code_challenge')).toBeTruthy(); // PKCE

			const hop = await request.get(auth.toString(), { maxRedirects: 0 });
			expect(hop.status()).toBe(302);
			const provided = new URL(hop.headers()['location']);
			expect(provided.host).toBe(host);
			expect(provided.searchParams.get('client_id')).toBe(clientId);
		});
	}

	test('a provider that is not on the list is a 404', async ({ request }) => {
		expect((await request.get('/login/myspace', { maxRedirects: 0 })).status()).toBe(404);
		expect((await request.get('/login/apple', { maxRedirects: 0 })).status()).toBe(404);
	});

	test('the callback without a code, or with one that cannot be used, goes back to the login page', async ({
		request
	}) => {
		const none = await request.get('/auth/callback', { maxRedirects: 0 });
		expect(none.headers()['location']).toBe('/login?error=missing_code');

		const bad = await request.get('/auth/callback?code=not-a-real-code', { maxRedirects: 0 });
		expect(bad.headers()['location']).toBe('/login?error=exchange_failed');
	});

	test('says what to do when a link was opened in another browser', async ({ page }) => {
		await page.goto('/login?error=exchange_failed');

		await expect(page.getByRole('alert')).toContainText('Abra-o no mesmo navegador');
	});

	test('signing out is a POST that lands on the home page, and a GET is refused', async ({
		request,
		baseURL
	}) => {
		const post = await request.post('/logout', {
			headers: { origin: baseURL!, accept: 'text/html' },
			form: {},
			maxRedirects: 0
		});
		const get = await request.get('/logout', { maxRedirects: 0 });

		expect(post.status()).toBe(303);
		expect(post.headers()['location']).toBe('/');
		expect(get.status()).toBe(405);
	});

	test('the new-password page needs the session a recovery link gives', async ({
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

	for (const path of ['/login', '/signup', '/forgot-password']) {
		test(`${path} renders without CSP violations`, async ({ page }) => {
			const violations: string[] = [];
			page.on('console', (message) => {
				if (/content security policy/i.test(message.text())) violations.push(message.text());
			});

			await page.goto(path);
			await page.waitForLoadState('networkidle');

			expect(violations).toEqual([]);
		});
	}
});
