import { describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../db/test-db';
import { finishLogin, startLogin } from './login';

const origin = 'https://mesaaberta.test';

describe('startLogin', () => {
	const supabase = (result: object) => ({
		auth: { signInWithOAuth: vi.fn().mockResolvedValue(result) }
	});

	it('asks Supabase for the provider URL, coming back to our callback with a safe next', async () => {
		const client = supabase({ data: { url: 'https://accounts.google.com/x' }, error: null });

		const url = await startLogin(client as never, {
			provider: 'google',
			origin,
			next: '/tables/new'
		});

		expect(url).toBe('https://accounts.google.com/x');
		expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
			provider: 'google',
			options: {
				redirectTo: `${origin}/auth/callback?next=%2Ftables%2Fnew`,
				skipBrowserRedirect: true
			}
		});
	});

	it('does not let next point at another site', async () => {
		const client = supabase({ data: { url: 'https://p.example' }, error: null });

		await startLogin(client as never, { provider: 'apple', origin, next: 'https://evil.example' });

		const { options } = client.auth.signInWithOAuth.mock.calls[0][0];
		expect(options.redirectTo).toBe(`${origin}/auth/callback?next=%2F`);
	});

	it('returns null when Supabase gives no URL', async () => {
		const client = supabase({ data: { url: null }, error: { message: 'provider disabled' } });

		expect(
			await startLogin(client as never, { provider: 'discord', origin, next: null })
		).toBeNull();
	});
});

describe('finishLogin', () => {
	const user = { id: '00000000-0000-4000-8000-000000000201', user_metadata: { name: 'Ana' } };

	const setup = async (exchange: object, options: { db?: boolean } = {}) => {
		const test = await createTestDb();
		const signOut = vi.fn();
		const supabase = {
			auth: { exchangeCodeForSession: vi.fn().mockResolvedValue(exchange), signOut }
		};
		const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() };
		const run = (code: string | null, next: string | null = null) =>
			finishLogin(
				{ supabase: supabase as never, db: options.db === false ? null : test.db, log },
				{ code, next }
			);

		return { run, signOut, supabase, log, test };
	};

	it('exchanges the code, creates the profile, and goes on to next', async () => {
		const { run, test } = await setup({ data: { user }, error: null });

		expect(await run('abc', '/tables/new')).toBe('/tables/new');
		expect(await test.db.query.profiles.findFirst()).toMatchObject({
			id: user.id,
			displayName: 'Ana',
			role: 'member'
		});
	});

	it('goes home when next is unsafe', async () => {
		const { run } = await setup({ data: { user }, error: null });

		expect(await run('abc', '//evil.example')).toBe('/');
	});

	it('goes back to the login page when the provider sent no code', async () => {
		const { run, supabase } = await setup({ data: {}, error: null });

		expect(await run(null)).toBe('/login?error=missing_code');
		expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
	});

	it('goes back to the login page when the code cannot be exchanged', async () => {
		const { run, log } = await setup({ data: { user: null }, error: { message: 'expired' } });

		expect(await run('bad')).toBe('/login?error=exchange_failed');
		expect(log.warn).toHaveBeenCalled();
	});

	it('signs the user out again if the profile cannot be created, rather than leave a half login', async () => {
		const { run, signOut, test, log } = await setup({ data: { user }, error: null });
		await test.close();

		expect(await run('abc')).toBe('/login?error=profile_failed');
		expect(signOut).toHaveBeenCalled();
		expect(log.error).toHaveBeenCalled();
	});

	it('signs out and says so when there is no database to keep the profile in', async () => {
		const { run, signOut } = await setup({ data: { user }, error: null }, { db: false });

		expect(await run('abc')).toBe('/login?error=unavailable');
		expect(signOut).toHaveBeenCalled();
	});
});
