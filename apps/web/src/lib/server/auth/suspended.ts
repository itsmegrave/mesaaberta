import { redirect, type Handle } from '@sveltejs/kit';
import { stillBanned } from '../moderation/bans';

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
  if (!profile || !event.locals.db) return resolve(event);
  // A temporary ban that has run out is lifted on the spot, so the person carries on.
  const { banned } = await stillBanned(event.locals.db, profile);
  if (!banned) return resolve(event);

  await supabase.auth.signOut();
  if (event.url.pathname === '/login') return resolve(event);
  redirect(303, SUSPENDED_LOGIN);
};
