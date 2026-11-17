import type { SupabaseClient } from '@supabase/supabase-js';

/** The parts of the auth client that are not public: where @supabase/ssr keeps the cookie session. */
type AuthInternals = {
  storage: { setItem(key: string, value: string): Promise<void> | void };
  storageKey: string;
};

/**
 * Keeps the PKCE code verifier the api Worker made for an e-mailed link (sign-up confirmation,
 * password reset) in the visitor's cookies, under the key the callback's `exchangeCodeForSession`
 * reads. The value is stored as auth-js stored it. @supabase/ssr writes a `-code-verifier` key to
 * the cookies at once. Without a verifier or a client there is nothing to keep.
 */
export async function keepCodeVerifier(
  supabase: SupabaseClient | null,
  verifier: unknown,
): Promise<void> {
  if (!supabase || typeof verifier !== 'string' || !verifier) return;
  const { storage, storageKey } = supabase.auth as unknown as AuthInternals;
  await storage.setItem(`${storageKey}-code-verifier`, verifier);
}
