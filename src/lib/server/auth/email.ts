import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { AnyDb } from '../db/client';
import type { Logger } from '../logger';
import { ensureProfile } from './profile';
import { safeNext } from './safe-next';

// Email and password sign-up and sign-in. Supabase Auth does all of it: it stores the (hashed)
// password, sends the confirmation email and verifies the session. This only calls it, then makes
// sure the person has a profile. The email address and the password are never logged.

type Deps = { supabase: SupabaseClient; db: AnyDb | null; log: Logger };

/** What the sign-up form should say. `check_email` is also the answer for an address that already has an account. */
export type SignUpResult =
	'signed_in' | 'check_email' | 'weak_password' | 'rate_limited' | 'failed';
export type SignInResult = 'ok' | 'invalid' | 'unconfirmed' | 'rate_limited' | 'failed';

const RATE_LIMITED = new Set([
	'over_email_send_rate_limit',
	'over_request_rate_limit',
	'over_sms_send_rate_limit'
]);

/** Creates the profile, or signs the person out again so nobody is left half signed in. */
async function keepProfile({ supabase, db, log }: Deps, user: User): Promise<boolean> {
	try {
		if (!db) throw new Error('no database to create the profile in');
		await ensureProfile(db, user);
		return true;
	} catch (error) {
		log.error('email auth: could not create the profile', { error });
		await supabase.auth.signOut();
		return false;
	}
}

export async function signUpWithEmail(
	deps: Deps,
	{
		email,
		password,
		origin,
		next
	}: { email: string; password: string; origin: string; next: string | null }
): Promise<SignUpResult> {
	const { data, error } = await deps.supabase.auth.signUp({
		email,
		password,
		// The link in the confirmation email comes back to our callback.
		options: {
			emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`
		}
	});

	if (error) {
		if (error.code === 'weak_password') return 'weak_password';
		if (error.code && RATE_LIMITED.has(error.code)) return 'rate_limited';
		// The code and status only: the message can quote the address.
		deps.log.warn('email auth: sign-up refused', { code: error.code, status: error.status });
		return 'failed';
	}

	// No session yet: the person has to confirm the address first. Supabase answers a repeat sign-up
	// the same way, so this never says whether the address was already registered.
	if (!data.session || !data.user) return 'check_email';

	return (await keepProfile(deps, data.user)) ? 'signed_in' : 'failed';
}

export async function signInWithEmail(
	deps: Deps,
	{ email, password }: { email: string; password: string }
): Promise<SignInResult> {
	const { data, error } = await deps.supabase.auth.signInWithPassword({ email, password });

	if (error) {
		// A wrong password and an unknown address get the same code, so the form cannot tell them apart.
		if (error.code === 'invalid_credentials') return 'invalid';
		if (error.code === 'email_not_confirmed') return 'unconfirmed';
		if (error.code && RATE_LIMITED.has(error.code)) return 'rate_limited';
		deps.log.warn('email auth: sign-in refused', { code: error.code, status: error.status });
		return 'failed';
	}

	return (await keepProfile(deps, data.user)) ? 'ok' : 'failed';
}
