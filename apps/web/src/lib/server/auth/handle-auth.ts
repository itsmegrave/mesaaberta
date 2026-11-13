import type { Handle } from '@sveltejs/kit/hooks';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import type { profiles } from '@mesaaberta/core/server/db/schema';
import { apiConfigured, readMe } from '../me';

/** Supabase settings on the Worker. Both are public by design: they only identify the project. */
type AuthEnv = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  /**
   * `local` checks the session token's signature here, against Supabase's published keys (cached
   * by the client for ten minutes), instead of asking Supabase on every request. Anything else
   * asks Supabase (`getUser`), as before.
   */
  SESSION_CHECK?: string;
};

/**
 * Sets up `locals.supabase` (session cookies through @supabase/ssr) and `locals.getUser()`.
 *
 * `getUser()` verifies the session token on every request that needs a user, and never trusts the
 * cookie unchecked, because a cookie can be forged. With `SESSION_CHECK=local` it checks the
 * token's signature itself (`getClaims`, no network call; Supabase falls back to asking when the
 * project signs with a shared secret). The trade-off: a session revoked elsewhere stays valid here
 * until its token expires (an hour at most); suspension and deleted accounts are still caught by
 * the profile read. Otherwise it asks Supabase (`getUser`). Without the
 * Supabase settings, auth is simply off: no client, and everyone is anonymous.
 */
export const createHandleAuth =
  (createClient: typeof createServerClient = createServerClient): Handle =>
  async ({ event, resolve }) => {
    const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SESSION_CHECK } = (event.locals.env ??
      {}) as AuthEnv;

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

        const user =
          SESSION_CHECK === 'local'
            ? await claimedUser(supabase)
            : await supabase.auth
                .getUser()
                .then(({ data, error }) => (error ? null : data.user))
                .then(async (found) =>
                  found && (await sessionIsForSite(supabase)) ? found : null,
                );
        if (!user) return null;

        event.locals.userId = user.id;
        return user;
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

/**
 * The user the verified token's claims describe. The app reads only `id`, `email` and
 * `user_metadata` from a user, and the token carries all three.
 */
async function claimedUser(supabase: {
  auth: Pick<ReturnType<typeof createServerClient>['auth'], 'getClaims'>;
}): Promise<User | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub || !isSiteSession(claims)) return null;
  return {
    id: claims.sub,
    email: claims.email,
    phone: claims.phone,
    aud: Array.isArray(claims.aud) ? (claims.aud[0] ?? '') : (claims.aud ?? ''),
    app_metadata: claims.app_metadata ?? {},
    user_metadata: claims.user_metadata ?? {},
    is_anonymous: claims.is_anonymous,
    created_at: '',
  } as User;
}

/**
 * Whether verified claims belong to a sign-in on this site, not to a token Supabase's OAuth 2.1
 * server issued to some client (the MCP, or any client a person approved on /oauth/consent). Those
 * carry `client_id` and are signed by the same project keys, so without this check a token handed
 * to a third-party app would also open the site as that person, admin area included. The MCP
 * Worker checks the opposite (it requires `client_id`).
 */
export function isSiteSession(claims: { aud?: unknown; client_id?: unknown }): boolean {
  if (claims.client_id !== undefined && claims.client_id !== null && claims.client_id !== '')
    return false;
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  return audiences.includes('authenticated');
}

/** The same check on the cookie session that `getUser` just verified with Supabase. */
async function sessionIsForSite(supabase: {
  auth: Pick<ReturnType<typeof createServerClient>['auth'], 'getSession'>;
}): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const payload = token ? decodePayload(token) : null;
  return payload !== null && isSiteSession(payload);
}

/** The payload of a JWT, unverified (only for a token Supabase has just vouched for). */
function decodePayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (c) =>
        c.charCodeAt(0),
      ),
    );
    const value: unknown = JSON.parse(json);
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
