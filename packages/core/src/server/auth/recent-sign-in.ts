/**
 * When the person last proved who they are, from a verified access token's `amr` claim: each entry
 * is one way they authenticated (password, a provider, a passkey, a recovery link) with its time in
 * seconds. A token refresh keeps the entries; a new sign-in adds a fresh one. Null when the claim
 * has no usable time.
 */
export function lastSignInAt(claims: { amr?: unknown } | null | undefined): number | null {
  if (!claims || !Array.isArray(claims.amr)) return null;
  const times = claims.amr
    .map((entry: unknown) =>
      entry && typeof entry === 'object' ? (entry as { timestamp?: unknown }).timestamp : undefined,
    )
    .filter((time): time is number => typeof time === 'number' && Number.isFinite(time));
  return times.length === 0 ? null : Math.max(...times) * 1000;
}

/** How recent a sign-in must be before changing a password, a passkey or a way in, or closing the account. */
export const RECENT_SIGN_IN_MINUTES = 10;

/** How long a password-recovery link's sign-in may set a new password. */
export const RECOVERY_SIGN_IN_MINUTES = 15;

/**
 * Whether the person signed in at most `minutes` ago. A session that only stayed open (a shared
 * computer, a copied cookie) is not enough for changes that would lock the owner out; no time at all
 * counts as not recent.
 */
export function signedInWithin(
  signedInAt: number | null,
  minutes: number,
  now: number = Date.now(),
): boolean {
  if (signedInAt === null) return false;
  // A clock a little ahead of ours still counts; a time far in the future does not.
  return now - signedInAt <= minutes * 60_000 && signedInAt - now <= 60_000;
}

/**
 * The payload of an access token, NOT verified. Only for refusing early: a token that passes here
 * must still be accepted by Supabase, which checks its signature, before anything is changed.
 */
export function unverifiedClaims(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (c) =>
      c.charCodeAt(0),
    );
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
