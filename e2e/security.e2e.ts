import { expect, test } from '@playwright/test';

test.describe('security headers', () => {
	for (const path of ['/', '/healthz', '/nao-existe']) {
		test(`are set on ${path}`, async ({ request }) => {
			const headers = (await request.get(path)).headers();

			expect(headers['x-content-type-options']).toBe('nosniff');
			expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
			expect(headers['strict-transport-security']).toMatch(/^max-age=\d{7,}/);
		});
	}

	// SvelteKit sends the CSP with HTML documents only; a JSON response has nothing to police.
	for (const path of ['/', '/nao-existe']) {
		test(`the CSP forbids framing on ${path}`, async ({ request }) => {
			const headers = (await request.get(path)).headers();

			expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
		});
	}

	test('the CSP has a nonce that changes on every request', async ({ request }) => {
		const nonceOf = async () => {
			const response = await request.get('/');
			return response.headers()['content-security-policy'].match(/'nonce-([^']+)'/)?.[1];
		};

		const first = await nonceOf();
		const second = await nonceOf();

		expect(first).toBeTruthy();
		expect(first).not.toBe(second);
	});

	test('the nonce in the header is the one on the page scripts', async ({ request }) => {
		const response = await request.get('/');
		const nonce = response.headers()['content-security-policy'].match(/'nonce-([^']+)'/)?.[1];

		expect(await response.text()).toContain(`nonce="${nonce}"`);
	});

	test('the page renders and hydrates without a single CSP violation', async ({ page }) => {
		const violations: string[] = [];
		await page.addInitScript(() =>
			document.addEventListener('securitypolicyviolation', (event) =>
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				((window as any).__violations ??= []).push(`${event.violatedDirective} ${event.blockedURI}`)
			)
		);
		page.on('console', (message) => {
			if (/content security policy/i.test(message.text())) violations.push(message.text());
		});

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const reported = await page.evaluate(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			() => (window as any).__violations ?? []
		);
		expect([...violations, ...reported]).toEqual([]);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});
});

test.describe('CSRF', () => {
	test('a form POST from another origin is refused', async ({ request }) => {
		const response = await request.post('/', {
			headers: { origin: 'https://evil.example' },
			form: { a: 'b' }
		});

		expect(response.status()).toBe(403);
	});

	test('a form POST from our own origin is not refused as CSRF', async ({ request, baseURL }) => {
		const response = await request.post('/', {
			headers: { origin: baseURL! },
			form: { a: 'b' }
		});

		expect(response.status()).not.toBe(403);
	});
});
