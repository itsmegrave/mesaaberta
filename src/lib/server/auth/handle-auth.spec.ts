import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { createHandleAuth } from './handle-auth';

const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' };

const setup = (platformEnv: object | undefined, getUser = vi.fn()) => {
	const createClient = vi.fn(() => ({ auth: { getUser } }));
	const event = {
		locals: {},
		cookies: { getAll: () => [], set: vi.fn() },
		platform: platformEnv && { env: platformEnv }
	} as unknown as RequestEvent;
	const run = () =>
		createHandleAuth(createClient as never)({ event, resolve: async () => new Response() });

	return { createClient, event, run, getUser };
};

describe('handleAuth', () => {
	it('leaves auth off when Supabase is not configured: no client, and nobody is signed in', async () => {
		const { createClient, event, run } = setup({});
		await run();

		expect(createClient).not.toHaveBeenCalled();
		expect(event.locals.supabase).toBeNull();
		expect(await event.locals.getUser()).toBeNull();
	});

	it('needs both the URL and the key', async () => {
		const { event, run } = setup({ SUPABASE_URL: env.SUPABASE_URL });
		await run();

		expect(event.locals.supabase).toBeNull();
	});

	it('returns the user Supabase verified, and records the id for the request log', async () => {
		const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
		const { event, run } = setup(env, getUser);
		await run();

		expect(await event.locals.getUser()).toEqual({ id: 'u1' });
		expect(event.locals.userId).toBe('u1');
	});

	it('asks Supabase once per request however often a route asks who is signed in', async () => {
		const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
		const { event, run } = setup(env, getUser);
		await run();

		await Promise.all([event.locals.getUser(), event.locals.getUser()]);
		await event.locals.getUser();

		expect(getUser).toHaveBeenCalledOnce();
	});

	it.each([
		['no session', { data: { user: null }, error: { message: 'Auth session missing!' } }],
		['a rejected token', { data: { user: null }, error: { message: 'invalid JWT' } }]
	])('treats %s as anonymous', async (_name, answer) => {
		const { event, run } = setup(env, vi.fn().mockResolvedValue(answer));
		await run();

		expect(await event.locals.getUser()).toBeNull();
		expect(event.locals.userId).toBeUndefined();
	});

	it('never trusts an unverified answer: a user that comes with an error is anonymous', async () => {
		const { event, run } = setup(
			env,
			vi.fn().mockResolvedValue({ data: { user: { id: 'forged' } }, error: { message: 'bad' } })
		);
		await run();

		expect(await event.locals.getUser()).toBeNull();
	});
});
