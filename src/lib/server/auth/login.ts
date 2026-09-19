import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnyDb } from '../db/client';
import type { Logger } from '../logger';
import type { Provider } from '$lib/auth/providers';
import { ensureProfile } from './profile';
import { safeNext } from './safe-next';

/** Where to send the visitor to sign in at the provider, or null if Supabase gave no URL. */
export async function startLogin(
	supabase: SupabaseClient,
	{ provider, origin, next }: { provider: Provider; origin: string; next: string | null }
): Promise<string | null> {
	const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;

	const { data } = await supabase.auth.signInWithOAuth({
		provider,
		// The URL comes back to us so the server can redirect; PKCE keeps its verifier in a cookie.
		options: { redirectTo, skipBrowserRedirect: true }
	});

	return data?.url ?? null;
}

/**
 * The provider sent the visitor back with a `code`. Trade it for a session, make sure a profile
 * exists, and answer with where to go next. Any failure signs the user out again and goes back to
 * the login page with an error code, so nobody is left half signed in.
 */
export async function finishLogin(
	deps: { supabase: SupabaseClient; db: AnyDb | null; log: Logger },
	{ code, next }: { code: string | null; next: string | null }
): Promise<string> {
	const { supabase, db, log } = deps;

	if (!code) return '/login?error=missing_code';

	const { data, error } = await supabase.auth.exchangeCodeForSession(code);
	if (error || !data.user) {
		log.warn('login: could not exchange the code', { error });
		return '/login?error=exchange_failed';
	}

	if (!db) {
		log.error('login: there is no database to create the profile in');
		await supabase.auth.signOut();
		return '/login?error=unavailable';
	}

	try {
		await ensureProfile(db, data.user);
	} catch (error) {
		log.error('login: could not create the profile', { error });
		await supabase.auth.signOut();
		return '/login?error=profile_failed';
	}

	return safeNext(next);
}
