import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { actions, load } from './+page.server';

const setup = (answer: object = { data: {}, error: null }, supabase = true) => {
	const resetPasswordForEmail = vi.fn().mockResolvedValue(answer);
	const locals = {
		supabase: supabase ? { auth: { resetPasswordForEmail } } : null,
		log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() }
	};
	const event = (fields: Record<string, string> = {}) => {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) body.set(k, v);
		const url = new URL('https://mesaaberta.app/forgot-password');
		return {
			locals,
			url,
			request: new Request(url, { method: 'POST', body })
		} as unknown as RequestEvent;
	};

	return { resetPasswordForEmail, event };
};

const submit = (event: RequestEvent) =>
	(actions as Record<string, (e: RequestEvent) => Promise<unknown>>).default(event);

describe('the forgot-password page', () => {
	it('says a link expired only when it is sent here for that reason, and shows no text from the address', () => {
		const url = (search: string) =>
			({ url: new URL(`https://x.test/forgot-password${search}`) }) as unknown as RequestEvent;

		expect((load as (e: RequestEvent) => unknown)(url(''))).toEqual({ linkExpired: false });
		expect((load as (e: RequestEvent) => unknown)(url('?error=<script>'))).toEqual({
			linkExpired: true
		});
	});

	it('asks Supabase for a link and says "sent"', async () => {
		const { event, resetPasswordForEmail } = setup();

		expect(await submit(event({ email: 'Ana@Example.com' }))).toEqual({ sent: true });
		expect(resetPasswordForEmail).toHaveBeenCalledWith('ana@example.com', {
			redirectTo: 'https://mesaaberta.app/auth/callback?next=%2Freset-password'
		});
	});

	it('gives the very same answer for an address that has no account, since Supabase does not say either', async () => {
		const known = setup();
		const unknown = setup();

		expect(await submit(known.event({ email: 'ana@example.com' }))).toEqual(
			await submit(unknown.event({ email: 'nobody@example.com' }))
		);
	});

	it('refuses something that is not an email before Supabase is asked', async () => {
		const { event, resetPasswordForEmail } = setup();

		expect(await submit(event({ email: 'nope' }))).toMatchObject({
			status: 400,
			data: { errors: { email: expect.any(String) } }
		});
		expect(resetPasswordForEmail).not.toHaveBeenCalled();
	});

	it('says to wait when Supabase is rate limiting, and that it failed on any other error', async () => {
		const limited = setup({
			data: null,
			error: { code: 'over_email_send_rate_limit', status: 429, message: 'x' }
		});
		const broken = setup({ data: null, error: { code: 'boom', status: 500, message: 'x' } });

		expect(await submit(limited.event({ email: 'ana@example.com' }))).toMatchObject({
			status: 429,
			data: { result: 'rate_limited' }
		});
		expect(await submit(broken.event({ email: 'ana@example.com' }))).toMatchObject({
			status: 500,
			data: { result: 'failed' }
		});
	});

	it('goes back to the login page, which says so, when there is no Supabase', async () => {
		const { event } = setup({}, false);

		await expect(submit(event({ email: 'ana@example.com' }))).rejects.toMatchObject({
			status: 303,
			location: '/login?error=unavailable'
		});
	});
});
