import { describe, expect, it, vi } from 'vitest';
import { createTestDb } from '../db/test-db';
import { signInWithEmail, signUpWithEmail } from './email';

const user = { id: '00000000-0000-4000-8000-000000000701', user_metadata: {} };
const origin = 'https://mesaaberta.app';
const log = () => ({
	info: vi.fn(),
	error: vi.fn(),
	warn: vi.fn(),
	debug: vi.fn(),
	child: vi.fn()
});

const setup = async (
	method: 'signUp' | 'signInWithPassword',
	answer: object,
	options: { db?: boolean } = {}
) => {
	const test = await createTestDb();
	const signOut = vi.fn();
	const call = vi.fn().mockResolvedValue(answer);
	const supabase = { auth: { [method]: call, signOut } };
	const l = log();

	return {
		test,
		signOut,
		call,
		log: l,
		deps: { supabase: supabase as never, db: options.db === false ? null : test.db, log: l }
	};
};

describe('signUpWithEmail', () => {
	const input = {
		email: 'ana@example.com',
		password: 'correct horse',
		origin,
		next: '/tables/new'
	};

	it('asks Supabase to create the account and to send the confirmation link back to our callback', async () => {
		const { deps, call } = await setup('signUp', { data: { user, session: null }, error: null });

		await signUpWithEmail(deps, input);

		expect(call).toHaveBeenCalledWith({
			email: 'ana@example.com',
			password: 'correct horse',
			options: { emailRedirectTo: `${origin}/auth/callback?next=%2Ftables%2Fnew` }
		});
	});

	it('does not let next point at another site', async () => {
		const { deps, call } = await setup('signUp', { data: { user, session: null }, error: null });

		await signUpWithEmail(deps, { ...input, next: 'https://evil.example' });

		expect(call.mock.calls[0][0].options.emailRedirectTo).toBe(`${origin}/auth/callback?next=%2F`);
	});

	it('says to check the email when there is no session yet, which is the normal case', async () => {
		const { deps } = await setup('signUp', { data: { user, session: null }, error: null });

		expect(await signUpWithEmail(deps, input)).toBe('check_email');
	});

	it('gives the same answer for an address that already has an account, so it cannot be used to find out who is registered', async () => {
		// Supabase answers a repeat sign-up like a first one (a user with no identities, no session, no error).
		const { deps } = await setup('signUp', {
			data: { user: { ...user, identities: [] }, session: null },
			error: null
		});

		expect(await signUpWithEmail(deps, input)).toBe('check_email');
	});

	it('creates the profile and signs in at once when Supabase does not require confirmation', async () => {
		const { deps, test } = await setup('signUp', {
			data: { user, session: { access_token: 'x' } },
			error: null
		});

		expect(await signUpWithEmail(deps, input)).toBe('signed_in');
		expect(await test.db.query.profiles.findFirst()).toMatchObject({ id: user.id, role: 'member' });
	});

	it('names no part of the address in the default display name', async () => {
		const { deps, test } = await setup('signUp', {
			data: { user, session: { access_token: 'x' } },
			error: null
		});

		await signUpWithEmail(deps, input);

		const profile = await test.db.query.profiles.findFirst();
		expect(JSON.stringify(profile)).not.toContain('ana');
	});

	it.each([
		['weak_password', 'weak_password'],
		['over_email_send_rate_limit', 'rate_limited'],
		['something_unexpected', 'failed']
	])('turns the Supabase error %s into %s', async (code, result) => {
		const { deps } = await setup('signUp', {
			data: { user: null, session: null },
			error: { code, status: 400, message: 'x' }
		});

		expect(await signUpWithEmail(deps, input)).toBe(result);
	});

	it('signs out again when the profile cannot be created, rather than leave a half sign-up', async () => {
		const { deps, test, signOut } = await setup('signUp', {
			data: { user, session: { access_token: 'x' } },
			error: null
		});
		await test.close();

		expect(await signUpWithEmail(deps, input)).toBe('failed');
		expect(signOut).toHaveBeenCalled();
	});

	it('never writes the email address or the password to the log', async () => {
		const { deps, log: l } = await setup('signUp', {
			data: { user: null, session: null },
			error: { code: 'x', status: 400, message: 'User ana@example.com is not allowed' }
		});

		await signUpWithEmail(deps, input);

		const written = JSON.stringify([l.error.mock.calls, l.warn.mock.calls, l.info.mock.calls]);
		expect(written).not.toContain('ana@example.com');
		expect(written).not.toContain('correct horse');
	});
});

describe('signInWithEmail', () => {
	const input = { email: 'ana@example.com', password: 'correct horse' };

	it('signs in and makes sure the profile exists, since the first login after confirming may be this one', async () => {
		const { deps, test } = await setup('signInWithPassword', {
			data: { user, session: { access_token: 'x' } },
			error: null
		});

		expect(await signInWithEmail(deps, input)).toBe('ok');
		expect(await test.db.query.profiles.findFirst()).toMatchObject({ id: user.id });
	});

	it.each([
		['invalid_credentials', 'invalid'],
		['email_not_confirmed', 'unconfirmed'],
		['over_request_rate_limit', 'rate_limited'],
		['something_unexpected', 'failed']
	])('turns the Supabase error %s into %s', async (code, result) => {
		const { deps } = await setup('signInWithPassword', {
			data: { user: null, session: null },
			error: { code, status: 400, message: 'x' }
		});

		expect(await signInWithEmail(deps, input)).toBe(result);
	});

	it('does not say whether it was the email or the password that was wrong', async () => {
		const wrongPassword = await setup('signInWithPassword', {
			data: {},
			error: { code: 'invalid_credentials', status: 400, message: 'x' }
		});
		const noAccount = await setup('signInWithPassword', {
			data: {},
			error: { code: 'invalid_credentials', status: 400, message: 'x' }
		});

		expect(await signInWithEmail(wrongPassword.deps, input)).toBe(
			await signInWithEmail(noAccount.deps, input)
		);
	});

	it('signs out and says so when there is no database to keep the profile in', async () => {
		const { deps, signOut } = await setup(
			'signInWithPassword',
			{ data: { user, session: {} }, error: null },
			{ db: false }
		);

		expect(await signInWithEmail(deps, input)).toBe('failed');
		expect(signOut).toHaveBeenCalled();
	});
});
