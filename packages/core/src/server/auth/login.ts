import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import type { Logger } from '@mesaaberta/core/server/logger';
import type { Provider } from '../../auth/providers';
import { recordConnection } from '@mesaaberta/core/server/events/outbox';
import { ensureProfile, type AuthUser } from './profile';
import { stillBanned } from '@mesaaberta/core/server/moderation/bans';
import { needsOnboarding, onboardingUrl } from './onboarding';
import { safeNext } from './safe-next';

/** Where to send the visitor to sign in at the provider, or null if Supabase gave no URL. */
export async function startLogin(
  supabase: SupabaseClient,
  { provider, origin, next }: { provider: Provider; origin: string; next: string | null },
): Promise<string | null> {
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;

  const { data } = await supabase.auth.signInWithOAuth({
    provider,
    // The URL comes back to us so the server can redirect; PKCE keeps its verifier in a cookie.
    options: { redirectTo, skipBrowserRedirect: true },
  });

  return data?.url ?? null;
}

type CompleteDeps = { db: AnyDb; log: Logger; ip: string | null };

/** `ok` carries where to go next; the other two sign the person out again. */
export type CompleteLoginResult =
  { result: 'ok'; target: string } | { result: 'profile_failed' | 'suspended' };

/**
 * The database half of a provider sign-in, once the session exists: makes sure a profile exists,
 * refuses a banned account (a temporary ban that ran out is lifted here), records the connection and
 * answers where to go next (the onboarding step first, if the profile is not complete). It does not
 * touch the session: the caller signs the person out on a refusal. It runs in the api Worker.
 */
export async function completeLogin(
  { db, log, ip }: CompleteDeps,
  user: AuthUser,
  next: string | null,
): Promise<CompleteLoginResult> {
  let profile;
  try {
    profile = await ensureProfile(db, user);
  } catch (error) {
    log.error('auth.login_profile_not_created', { error });
    return { result: 'profile_failed' };
  }

  if ((await stillBanned(db, profile)).banned) return { result: 'suspended' };

  await recordConnection(db, { actorId: user.id, ip, log });

  // A first sign-in (or a profile from before usernames) goes through the onboarding step first.
  const target = safeNext(next);
  return { result: 'ok', target: needsOnboarding(profile) ? onboardingUrl(target) : target };
}

const REFUSED_AT = {
  profile_failed: '/login?error=profile_failed',
  suspended: '/login?error=suspended',
} as const;

/**
 * The provider sent the visitor back with a `code`. Trade it for a session, then finish the sign-in
 * with `completeLogin` (or with `remote`, which the web Worker sets to hand that half to the api;
 * null from it means "could not be used", and it runs here). Any failure signs the user out again and
 * goes back to the login page with an error code, so nobody is left half signed in.
 */
export async function finishLogin(
  deps: SettleDeps,
  { code, next }: { code: string | null; next: string | null },
): Promise<string> {
  const { supabase, log } = deps;

  if (!code) return '/login?error=missing_code';

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    log.warn('auth.login_code_exchange_failed', { error });
    return '/login?error=exchange_failed';
  }

  return settleLogin(deps, data.user, data.session?.access_token ?? null, next);
}

export type SettleDeps = {
  supabase: SupabaseClient;
  db: AnyDb | null;
  log: Logger;
  ip: string | null;
  remote?: (accessToken: string, next: string | null) => Promise<CompleteLoginResult | null>;
};

/**
 * The shared tail of every sign-in that makes a session here (a provider's code, a passkey): the
 * database half through `remote` (or `completeLogin` with a database), and on any failure the session
 * is signed out again, so nobody is left half signed in. Answers where to go next.
 */
export async function settleLogin(
  { supabase, db, log, ip, remote }: SettleDeps,
  user: AuthUser,
  token: string | null,
  next: string | null,
): Promise<string> {
  let done = remote && token ? await remote(token, next) : null;
  if (!done && db) done = await completeLogin({ db, log, ip }, user, next);
  if (!done) log.error('auth.login_no_database');
  if (!done) {
    await supabase.auth.signOut();
    return '/login?error=unavailable';
  }
  if (done.result !== 'ok') {
    await supabase.auth.signOut();
    return REFUSED_AT[done.result];
  }
  return done.target;
}
