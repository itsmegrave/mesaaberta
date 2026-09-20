import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from '../logger';

// Password reset through Supabase Auth's recovery flow: it emails a link, the link signs the person
// in through our callback, and `updateUser` sets the new password. The email address and the
// passwords are never logged.

type Deps = { supabase: SupabaseClient; log: Logger };

/** `sent` is the answer whether or not the address has an account: Supabase does not say, and neither do we. */
export type ResetRequestResult = 'sent' | 'rate_limited' | 'failed';
export type ChangePasswordResult =
	'ok' | 'weak_password' | 'same_password' | 'no_session' | 'rate_limited' | 'failed';

const RATE_LIMITED = new Set(['over_email_send_rate_limit', 'over_request_rate_limit']);

export async function requestPasswordReset(
	{ supabase, log }: Deps,
	{ email, origin }: { email: string; origin: string }
): Promise<ResetRequestResult> {
	const { error } = await supabase.auth.resetPasswordForEmail(email, {
		// The link comes back to the callback, which trades its code for a session and moves on.
		redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`
	});

	if (!error) return 'sent';
	if (error.code && RATE_LIMITED.has(error.code)) return 'rate_limited';

	// The code and status only: the message can quote the address.
	log.warn('password reset: request refused', { code: error.code, status: error.status });
	return 'failed';
}

/** Sets a new password for whoever is signed in (the recovery link signed them in). */
export async function changePassword(
	{ supabase, log }: Deps,
	{ password }: { password: string }
): Promise<ChangePasswordResult> {
	const { error } = await supabase.auth.updateUser({ password });

	if (error) {
		if (error.code === 'weak_password') return 'weak_password';
		if (error.code === 'same_password') return 'same_password';
		if (error.name === 'AuthSessionMissingError') return 'no_session';
		if (error.code && RATE_LIMITED.has(error.code)) return 'rate_limited';

		log.warn('password reset: change refused', { code: error.code, status: error.status });
		return 'failed';
	}

	// Whoever else was signed in with the old password (a stolen session, a forgotten device) is out.
	try {
		await supabase.auth.signOut({ scope: 'others' });
	} catch (signOutError) {
		log.warn('password reset: could not sign the other sessions out', { error: signOutError });
	}

	return 'ok';
}
