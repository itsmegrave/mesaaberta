import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from '@mesaaberta/core/server/logger';
import { settleLogin, type SettleDeps } from './login';

/**
 * Passkeys through Supabase Auth's own passkey support (beta), run from the server: Supabase issues
 * the challenge and checks the answer, and the session it makes lands in the httpOnly cookies the
 * server client writes, like every other sign-in. The browser only runs the WebAuthn prompt between
 * the two steps. Nothing here touches the database: Supabase keeps the passkeys.
 */

/** A challenge for the browser's WebAuthn prompt: the options in the W3C JSON form, and its id. */
export type PasskeyChallenge = { challengeId: string; options: unknown };

/** A passkey as the account settings list it. */
export type PasskeySummary = {
  id: string;
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

/** The credential the browser hands back, as JSON. Checked by Supabase; here only its shape. */
export function parseCredential(text: string): Record<string, unknown> | null {
  if (!text || text.length > 64_000) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const { id, type, response } = value as Record<string, unknown>;
    if (typeof id !== 'string' || type !== 'public-key') return null;
    if (!response || typeof response !== 'object') return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** A challenge to sign in with: no account named, the browser offers the passkeys it has. */
export async function signInChallenge(
  supabase: SupabaseClient,
  log: Logger,
  captchaToken?: string,
): Promise<PasskeyChallenge | null> {
  const { data, error } = await supabase.auth.passkey.startAuthentication({
    options: captchaToken ? { captchaToken } : undefined,
  });
  if (error || !data) {
    log.warn('auth.passkey_options_failed', { code: error?.code, status: error?.status });
    return null;
  }
  return { challengeId: data.challenge_id, options: data.options };
}

/**
 * The browser answered the sign-in challenge. Supabase checks the answer and makes the session
 * (written to the cookies), then the sign-in finishes like a provider's (`settleLogin`: profile, ban,
 * connection record, where to go). Null when Supabase refused the passkey: nobody is signed in.
 */
export async function finishPasskeyLogin(
  deps: SettleDeps,
  {
    challengeId,
    credential,
    next,
  }: { challengeId: string; credential: Record<string, unknown>; next: string | null },
): Promise<string | null> {
  const { data, error } = await deps.supabase.auth.passkey.verifyAuthentication({
    challengeId,
    credential: credential as never,
  });
  if (error || !data?.user || !data.session) {
    deps.log.warn('auth.passkey_sign_in_refused', { code: error?.code });
    return null;
  }
  return settleLogin(deps, data.user, data.session.access_token, next);
}

/** A challenge to add a passkey to the signed-in account (the session in the client's cookies). */
export async function registrationChallenge(
  supabase: SupabaseClient,
  log: Logger,
): Promise<PasskeyChallenge | null> {
  const { data, error } = await supabase.auth.passkey.startRegistration();
  if (error || !data) {
    log.warn('auth.passkey_registration_options_failed', {
      code: error?.code,
      status: error?.status,
    });
    return null;
  }
  return { challengeId: data.challenge_id, options: data.options };
}

/** The browser made the new passkey: Supabase checks it and keeps it. False when it refused. */
export async function finishRegistration(
  supabase: SupabaseClient,
  log: Logger,
  { challengeId, credential }: { challengeId: string; credential: Record<string, unknown> },
): Promise<boolean> {
  const { error } = await supabase.auth.passkey.verifyRegistration({
    challengeId,
    credential: credential as never,
  });
  if (error) {
    log.warn('auth.passkey_registration_refused', { code: error.code });
    return false;
  }
  return true;
}

/** The account's passkeys, newest first; null when Supabase could not answer. */
export async function listPasskeys(
  supabase: SupabaseClient,
  log: Logger,
): Promise<PasskeySummary[] | null> {
  const { data, error } = await supabase.auth.passkey.list();
  if (error || !data) {
    log.warn('auth.passkey_list_failed', { code: error?.code, status: error?.status });
    return null;
  }
  return data
    .map((p) => ({
      id: p.id,
      name: p.friendly_name || null,
      createdAt: p.created_at,
      lastUsedAt: p.last_used_at ?? null,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Removes one of the account's passkeys. False when Supabase refused or failed. */
export async function removePasskey(
  supabase: SupabaseClient,
  log: Logger,
  passkeyId: string,
): Promise<boolean> {
  const { error } = await supabase.auth.passkey.delete({ passkeyId });
  if (error) {
    log.warn('auth.passkey_remove_failed', { code: error.code, status: error.status });
    return false;
  }
  return true;
}
