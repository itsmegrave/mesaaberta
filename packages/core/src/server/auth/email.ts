import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import type { Logger } from '@mesaaberta/core/server/logger';
import { recordConnection } from '@mesaaberta/core/server/events/outbox';
import { ensureProfile } from './profile';
import { stillBanned } from '@mesaaberta/core/server/moderation/bans';
import { safeNext } from './safe-next';

// Email and password sign-up and sign-in. Supabase Auth does all of it: it stores the (hashed)
// password, sends the confirmation email and verifies the session. This only calls it, then makes
// sure the person has a profile. The email address and the password are never logged.

type Deps = { supabase: SupabaseClient; db: AnyDb | null; log: Logger; ip: string | null };

/** What the sign-up form should say. `check_email` is also the answer for an address that already has an account. */
export type SignUpResult =
  'signed_in' | 'check_email' | 'weak_password' | 'rate_limited' | 'failed';
export type SignInResult =
  'ok' | 'invalid' | 'unconfirmed' | 'suspended' | 'rate_limited' | 'failed';

const RATE_LIMITED = new Set([
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'over_sms_send_rate_limit',
]);

/**
 * Creates the profile, or signs the person out again so nobody is left half signed in. Returns
 * whether the person keeps the session: `suspended` signs them out too.
 */
async function keepProfile(
  { supabase, db, log }: Deps,
  user: User,
): Promise<'kept' | 'suspended' | 'failed'> {
  try {
    if (!db) throw new Error('no database to create the profile in');
    const profile = await ensureProfile(db, user);
    // A temporary ban that ran out is lifted here; anything else still barred is signed out.
    if (!profile || !(await stillBanned(db, profile)).banned) return 'kept';
  } catch (error) {
    log.error('auth.email_profile_not_created', { error });
    await supabase.auth.signOut();
    return 'failed';
  }
  await supabase.auth.signOut();
  return 'suspended';
}

/** `keepProfile` already checked that `db` is there when it returns `kept`. */
const signedIn = async ({ db, ip, log }: Deps, user: User) =>
  recordConnection(db as AnyDb, { actorId: user.id, ip, log });

/** The JWT pair Supabase issued; the caller sets it as the person's session. Never log it. */
export type SessionTokens = { accessToken: string; refreshToken: string };

/**
 * Signs up and, when the person is signed in at once (no confirmation e-mail needed), hands back the
 * session's tokens so another Worker (the api) can pass it to the one that sets the cookie.
 * `signUpWithEmail` is this without them.
 */
export async function signUpForSession(
  deps: Deps,
  {
    email,
    password,
    origin,
    next,
  }: { email: string; password: string; origin: string; next: string | null },
): Promise<{ result: SignUpResult; session: SessionTokens | null }> {
  const { data, error } = await deps.supabase.auth.signUp({
    email,
    password,
    // The link in the confirmation email comes back to our callback.
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
    },
  });

  if (error) {
    if (error.code === 'weak_password') return { result: 'weak_password', session: null };
    // Auth answers a sign-up for an address that already has a confirmed account with a 422, not
    // with a look-alike success (found by the e2e tests against a real Auth). Saying so would tell
    // anyone who is registered, so it gets the same answer as a first sign-up.
    if (error.code === 'user_already_exists') return { result: 'check_email', session: null };
    if (error.code && RATE_LIMITED.has(error.code))
      return { result: 'rate_limited', session: null };
    // The code and status only: the message can quote the address.
    deps.log.warn('auth.email_sign_up_refused', { code: error.code, status: error.status });
    return { result: 'failed', session: null };
  }

  // No session yet: the person has to confirm the address first. Supabase answers a repeat sign-up
  // the same way, so this never says whether the address was already registered.
  if (!data.session || !data.user) return { result: 'check_email', session: null };

  // A brand-new account is never suspended; anything but `kept` is a failure here.
  if ((await keepProfile(deps, data.user)) !== 'kept') return { result: 'failed', session: null };
  await signedIn(deps, data.user);
  return {
    result: 'signed_in',
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    },
  };
}

export async function signUpWithEmail(
  deps: Deps,
  details: { email: string; password: string; origin: string; next: string | null },
): Promise<SignUpResult> {
  return (await signUpForSession(deps, details)).result;
}

/**
 * Signs in and, when the person keeps the session, hands back its tokens so another Worker (the
 * api) can pass the session to the one that sets the cookie. `signInWithEmail` is this without them.
 */
export async function signInForSession(
  deps: Deps,
  { email, password }: { email: string; password: string },
): Promise<{ result: SignInResult; session: SessionTokens | null }> {
  const { data, error } = await deps.supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // A wrong password and an unknown address get the same code, so the form cannot tell them apart.
    if (error.code === 'invalid_credentials') return { result: 'invalid', session: null };
    if (error.code === 'email_not_confirmed') return { result: 'unconfirmed', session: null };
    if (error.code && RATE_LIMITED.has(error.code))
      return { result: 'rate_limited', session: null };
    deps.log.warn('auth.email_sign_in_refused', { code: error.code, status: error.status });
    return { result: 'failed', session: null };
  }

  const kept = await keepProfile(deps, data.user);
  if (kept !== 'kept') return { result: kept, session: null };
  await signedIn(deps, data.user);
  return {
    result: 'ok',
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    },
  };
}

export async function signInWithEmail(
  deps: Deps,
  credentials: { email: string; password: string },
): Promise<SignInResult> {
  return (await signInForSession(deps, credentials)).result;
}
