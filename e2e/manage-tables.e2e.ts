import { expect, test } from '@playwright/test';

// Signing in needs a Supabase project, so these cover what an anonymous visitor meets. The rest is
// covered by unit tests with a fake signed-in user.
test.describe('managing tables, anonymous', () => {
	for (const path of ['/tables/new', '/tables/mesa-do-dragao/edit']) {
		test(`${path} sends a visitor to log in, and back afterwards`, async ({ request }) => {
			const response = await request.get(path, { maxRedirects: 0 });

			expect(response.status()).toBe(303);
			expect(response.headers()['location']).toBe(`/login?next=${encodeURIComponent(path)}`);
		});
	}

	test('posting the create form without being signed in does not create anything', async ({
		request,
		baseURL
	}) => {
		const response = await request.post('/tables/new', {
			// A browser form asks for HTML; without it SvelteKit answers with a JSON redirect.
			headers: { origin: baseURL!, accept: 'text/html' },
			multipart: { title: 'Sem login', systemSlug: 'daggerheart' },
			maxRedirects: 0
		});

		expect(response.status()).toBe(303);
		expect(response.headers()['location']).toBe('/login?next=%2Ftables%2Fnew');
	});

	test('a form posted from another origin is refused outright', async ({ request }) => {
		const response = await request.post('/tables/new', {
			headers: { origin: 'https://evil.example' },
			multipart: { title: 'Forjado' },
			maxRedirects: 0
		});

		expect(response.status()).toBe(403);
	});

	test('the table list offers a way to open one', async ({ page }) => {
		await page.goto('/tables');

		await expect(page.getByRole('link', { name: 'Abrir uma mesa' })).toHaveAttribute(
			'href',
			'/tables/new'
		);
	});
});
