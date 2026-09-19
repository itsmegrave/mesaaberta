import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { handleSecurityHeaders } from './security-headers';

const event = {} as RequestEvent;

describe('handleSecurityHeaders', () => {
	it('adds the fixed security headers to the response', async () => {
		const response = await handleSecurityHeaders({
			event,
			resolve: async () => new Response('ok')
		});

		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
		expect(response.headers.get('strict-transport-security')).toBe('max-age=31536000');
	});

	it('keeps the status, body and the headers the route already set', async () => {
		const response = await handleSecurityHeaders({
			event,
			resolve: async () =>
				new Response('gone', { status: 404, headers: { 'cache-control': 'no-store' } })
		});

		expect(response.status).toBe(404);
		expect(await response.text()).toBe('gone');
		expect(response.headers.get('cache-control')).toBe('no-store');
	});

	it('does not overwrite a header a route chose deliberately', async () => {
		const response = await handleSecurityHeaders({
			event,
			resolve: async () => new Response('ok', { headers: { 'referrer-policy': 'no-referrer' } })
		});

		expect(response.headers.get('referrer-policy')).toBe('no-referrer');
	});
});
