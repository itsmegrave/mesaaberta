import { redirect } from '@sveltejs/kit';
import type { User } from '@supabase/supabase-js';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import { needsOnboarding, onboardingUrl } from '@mesaaberta/core/server/auth/onboarding';
import {
  RECENT_SIGN_IN_MINUTES,
  signedInWithin,
} from '@mesaaberta/core/server/auth/recent-sign-in';

/**
 * Call at the top of a `load` or action that needs a signed-in user. Anonymous visitors are sent
 * to the login page and brought back to where they were going. Someone whose profile has no
 * username yet is sent to finish it first (the onboarding step), and brought back the same way:
 * an incomplete profile reaches no authenticated route. Only the onboarding itself passes
 * `allowIncomplete`.
 */
export async function requireUser(
  locals: App.Locals,
  url: URL,
  { allowIncomplete = false }: { allowIncomplete?: boolean } = {},
): Promise<User> {
  const here = safeNext(url.pathname + url.search);

  const user = await locals.getUser();
  if (!user) redirect(303, `/login?next=${encodeURIComponent(here)}`);

  if (!allowIncomplete && needsOnboarding(await locals.getProfile())) {
    redirect(303, onboardingUrl(here));
  }

  return user;
}

/**
 * Call before a change that would let whoever holds the session lock the owner out: a new password,
 * adding or removing a passkey, disconnecting a way in, closing the account. Unless the person
 * signed in within the last `minutes`, the session is ended here and they are sent to sign in
 * again, then brought back to the page (never to the action itself, so nothing runs unasked).
 */
export async function requireRecentSignIn(
  locals: App.Locals,
  url: URL,
  minutes: number = RECENT_SIGN_IN_MINUTES,
): Promise<void> {
  if (signedInWithin(await locals.signedInAt(), minutes)) return;
  await locals.supabase?.auth.signOut({ scope: 'local' }).catch(() => undefined);
  const back = safeNext(url.pathname);
  redirect(303, `/login?next=${encodeURIComponent(back)}&reauth=1`);
}
