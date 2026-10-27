import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { readFromApi } from '../api-read';

/** Where a suspended account lands: the login page, with the message that says why. */
export const SUSPENDED_LOGIN = '/login?error=suspended';

/** Whether the request carries a Supabase session, so anonymous visitors cost no lookup. */
const hasSession = (cookies: { name: string }[]) =>
  cookies.some(({ name }) => name.startsWith('sb-') && name.includes('-auth-token'));

/**
 * A banned (suspended) account is signed out on its next request, wherever it was, and sent to the login
 * page, which says why. Signing in again is refused the same way (see `finishLogin` and
 * `signInWithEmail`). Runs after `handleAuth` and `handleDatabase`, which it needs.
 */
export const handleSuspended: Handle = async ({ event, resolve }) => {
  const { supabase } = event.locals;
  if (!supabase || !hasSession(event.cookies.getAll())) return resolve(event);

  const profile = await event.locals.getProfile().catch(() => null);
  if (!profile || profile.status !== 'suspended') return resolve(event);
  // A temporary ban that has run out is lifted on the spot by the api, so the person carries on.
  if (profile.bannedUntil && profile.bannedUntil <= new Date()) {
    const { banned } = await readFromApi<{ banned: boolean }>(
      event.locals,
      profile.id,
      '/v1/me/ban-check',
      {},
    );
    if (!banned) {
      // The rest of the request sees the account active.
      Object.assign(profile, {
        status: 'active',
        bannedAt: null,
        bannedUntil: null,
        banReason: null,
      });
      return resolve(event);
    }
  }

  await supabase.auth.signOut();
  if (event.url.pathname === '/login') return resolve(event);
  redirect(303, SUSPENDED_LOGIN);
};
