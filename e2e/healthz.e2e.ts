import { expect, test } from '@playwright/test';

test.describe('/healthz', () => {
	test('answers 200 with a JSON status and is never cached', async ({ request }) => {
		const response = await request.get('/healthz');

		expect(response.status()).toBe(200);
		expect(await response.json()).toEqual({ status: 'ok' });
		expect(response.headers()['cache-control']).toBe('no-store');
	});
});
