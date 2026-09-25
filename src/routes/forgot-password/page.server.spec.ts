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
	it('says a link expired only when it is sent here for that reason, and shows no text from the address', async () => {
		const url = (search: string) =>
			({ url: new URL(`https://x.test/forgot-password${search}`) }) as unknown as RequestEvent;

		expect(await (load as (e: RequestEvent) => Promise<unknown>)(url(''))).toEqual({
			linkExpired: false,
			form: expect.any(Object)
		});
		expect(
			await (load as (e: RequestEvent) => Promise<unknown>)(url('?error=<script>'))
		).toMatchObject({
			linkExpired: true
		});
	});

	it('asks Supabase for a link and says "sent"', async () => {
		const { event, resetPasswordForEmail } = setup();

		expect(await submit(event({ email: 'Ana@Example.com' }))).toMatchObject({
			form: { message: { code: 'sent' } }
		});
		expect(resetPasswordForEmail).toHaveBeenCalledWith('ana@example.com', {
			redirectTo: 'https://mesaaberta.app/auth/callback?next=%2Freset-password'
		});
	});

	it('gives the very same answer for an address that has no account, since Supabase does not say either', async () => {
		const known = setup();
		const unknown = setup();

		for (const result of [
			await submit(known.event({ email: 'ana@example.com' })),
			await submit(unknown.event({ email: 'nobody@example.com' }))
		])
			expect(result).toMatchObject({ form: { message: { code: 'sent' } } });
	});

	it('refuses something that is not an email before Supabase is asked', async () => {
		const { event, resetPasswordForEmail } = setup();

		expect(await submit(event({ email: 'nope' }))).toMatchObject({
			status: 400,
			data: { form: { errors: { email: expect.any(Array) } } }
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
			data: { form: { message: { code: 'rate_limited' } } }
		});
		expect(await submit(broken.event({ email: 'ana@example.com' }))).toMatchObject({
			status: 500,
			data: { form: { message: { code: 'failed' } } }
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
