import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { profiles } from '../db/schema';
import { createTestDb } from '../db/test-db';
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

describe('getProfile', () => {
	const id = '00000000-0000-4000-8000-000000000301';
	const signedIn = () => vi.fn().mockResolvedValue({ data: { user: { id } }, error: null });

	it("returns the signed-in user's profile: the actor the policy decides about", async () => {
		const test = await createTestDb();
		await test.db.insert(profiles).values({ id, username: 'ana', role: 'admin' });
		const { event, run } = setup(env, signedIn());
		event.locals.db = test.db as never;
		await run();

		expect(await event.locals.getProfile()).toMatchObject({ id, role: 'admin', status: 'active' });
		await test.close();
	});

	it('is null for an anonymous visitor, without touching the database', async () => {
		const { event, run } = setup({});
		event.locals.db = null;
		await run();

		expect(await event.locals.getProfile()).toBeNull();
	});

	it('is null when someone is signed in but has no profile, rather than a made-up actor', async () => {
		const test = await createTestDb();
		const { event, run } = setup(env, signedIn());
		event.locals.db = test.db as never;
		await run();

		expect(await event.locals.getProfile()).toBeNull();
		await test.close();
	});

	it('is null while no database is configured', async () => {
		const { event, run } = setup(env, signedIn());
		event.locals.db = null;
		await run();

		expect(await event.locals.getProfile()).toBeNull();
	});

	it('loads once per request however often it is asked', async () => {
		const test = await createTestDb();
		await test.db.insert(profiles).values({ id, username: 'ana' });
		const getUser = signedIn();
		const { event, run } = setup(env, getUser);
		event.locals.db = test.db as never;
		await run();

		const [a, b] = await Promise.all([event.locals.getProfile(), event.locals.getProfile()]);

		expect(a).toBe(b);
		expect(getUser).toHaveBeenCalledOnce();
		await test.close();
	});
});
