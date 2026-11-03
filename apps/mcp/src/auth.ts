import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Who an MCP request acts for: the person who approved the client, and the client itself. */
export type Caller = { userId: string; clientId: string; token: string; expiresAt?: number };

/** Supabase Auth's issuer for a project URL (`https://<ref>.supabase.co` → `…/auth/v1`). */
export const issuerOf = (supabaseUrl: string) => `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;

// The project's public keys, kept per isolate: jose caches them and refetches on an unknown `kid`.
const keySets = new Map<string, JWTVerifyGetKey>();

/** The JWKS of the project's asymmetric signing keys, which every access token is checked against. */
export function supabaseKeys(issuer: string): JWTVerifyGetKey {
  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    keySets.set(issuer, keys);
  }
  return keys;
}

/**
 * Checks a bearer token the way Supabase's OAuth 2.1 server documents it: signed by one of the
 * project's asymmetric keys, issued by the project, for `authenticated`, not expired, and carrying
 * the `client_id` claim. That claim is what only a token obtained through the consent page has: a
 * site session token (no `client_id`) is refused, so nothing reaches the MCP without the person
 * approving the client. Null for anything else; the reason is never told to the caller.
 */
export async function verifyToken(
  token: string,
  issuer: string,
  keys: JWTVerifyGetKey,
): Promise<Caller | null> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience: 'authenticated',
      // HS256 would need the project's shared secret here; only the published keys are trusted.
      algorithms: ['ES256', 'RS256'],
    });
    const clientId = payload.client_id;
    if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) return null;
    if (typeof clientId !== 'string' || clientId.length === 0) return null;
    return { userId: payload.sub, clientId, token, expiresAt: payload.exp };
  } catch {
    return null;
  }
}

/** The bearer token of an `Authorization` header, or null. */
export function bearerOf(header: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return match ? match[1] : null;
}
