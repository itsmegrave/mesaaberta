import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';

/** Supabase settings on the Worker. Both are public by design: they only identify the project. */
type AuthEnv = { SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string };

/**
 * Sets up `locals.supabase` (session cookies through @supabase/ssr) and `locals.getUser()`.
 *
 * `getUser()` asks Supabase to verify the session token on every request that needs a user. It
 * never reads the user out of the cookie itself, because a cookie can be forged. Without the
 * Supabase settings, auth is simply off: no client, and everyone is anonymous.
 */
export const createHandleAuth =
	(createClient: typeof createServerClient = createServerClient): Handle =>
	async ({ event, resolve }) => {
		const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = (event.platform?.env ?? {}) as AuthEnv;

		const supabase =
			SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
				? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
						cookies: {
							getAll: () => event.cookies.getAll(),
							setAll: (cookies) =>
								cookies.forEach(({ name, value, options }) =>
									event.cookies.set(name, value, { ...options, path: '/' })
								)
						}
					})
				: null;

		event.locals.supabase = supabase;

		let verified: Promise<User | null> | undefined;
		event.locals.getUser = () =>
			(verified ??= (async () => {
				if (!supabase) return null;

				const { data, error } = await supabase.auth.getUser();
				if (error || !data.user) return null;

				event.locals.userId = data.user.id;
				return data.user;
			})());

		return resolve(event);
	};

export const handleAuth = createHandleAuth();
