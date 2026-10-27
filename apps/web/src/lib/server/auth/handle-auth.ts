import type { Handle } from '@sveltejs/kit/hooks';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import type { profiles } from '@mesaaberta/core/server/db/schema';
import { apiConfigured, readMe } from '../me';

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
    const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = (event.locals.env ?? {}) as AuthEnv;

    const supabase =
      SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
        ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            cookies: {
              getAll: () => event.cookies.getAll(),
              // @supabase/ssr asks for `httpOnly: false` so a browser client could read the
              // session; this app has none, so the tokens stay out of reach of page scripts.
              // SvelteKit adds `secure` (except on http://localhost) and `sameSite: 'lax'`.
              setAll: (cookies) =>
                cookies.forEach(({ name, value, options }) =>
                  event.cookies.set(name, value, { ...options, path: '/', httpOnly: true }),
                ),
            },
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

    // The signed-in user's profile: the actor the authorization policy decides about, read by the
    // api Worker. Null when anonymous, without a profile, or while there is no api to ask.
    let profile: Promise<typeof profiles.$inferSelect | null> | undefined;

    event.locals.getProfile = () =>
      (profile ??= (async () => {
        const user = await event.locals.getUser();
        if (!user || !apiConfigured(event.locals.env)) return null;
        return readMe(event.locals, user.id);
      })());

    return resolve(event);
  };

export const handleAuth = createHandleAuth();
