import { and, asc, count, eq, gt, lt, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { authAttempts } from '../db/schema';
import { RateLimited } from '../errors';

/**
 * Limits on the forms anyone can use without an account (sign in, sign up, password reset), per
 * network, so a script cannot guess passwords or send reset e-mails in a loop before it ever reaches
 * Supabase Auth. The per-person limits in rate-limit.ts need a signed-in actor; these count by IP.
 *
 * Generous on purpose: a family, a school or a phone carrier (CGNAT) shares one address, and a
 * person who mistypes a password a few times must not be locked out. A script is far faster.
 */
export type AttemptLimit = {
  action: 'sign_in' | 'sign_up' | 'password_reset' | 'cep_lookup';
  max: number;
  windowSeconds: number;
};

export const SIGN_IN_LIMIT = {
  action: 'sign_in',
  max: 30,
  windowSeconds: 15 * 60,
} as const satisfies AttemptLimit;
export const SIGN_UP_LIMIT = {
  action: 'sign_up',
  max: 10,
  windowSeconds: 60 * 60,
} as const satisfies AttemptLimit;
export const PASSWORD_RESET_LIMIT = {
  action: 'password_reset',
  max: 10,
  windowSeconds: 60 * 60,
} as const satisfies AttemptLimit;

/** No limit looks back further than this, so older rows are deleted: the IP is personal data. */
const KEEP_SECONDS = 24 * 60 * 60;

/** A hash of the action and the address: the table never holds an IP. */
export async function attemptKey(action: AttemptLimit['action'], ip: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${action}:${ip}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Records an attempt from `ip`, or throws `RateLimited` (with how long to wait) when that address
 * already made `max` in the window. A refused attempt is not recorded, so waiting always works. The
 * check and the insert run under a lock on the key, so simultaneous requests cannot all slip in.
 */
export async function recordAttempt(
  db: AnyDb,
  limit: AttemptLimit,
  ip: string,
  now: Date = new Date(),
): Promise<void> {
  const key = await attemptKey(limit.action, ip);
  const windowStart = new Date(now.getTime() - limit.windowSeconds * 1000);

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`auth-attempt:${key}`}, 0))`,
    );
    await tx
      .delete(authAttempts)
      .where(lt(authAttempts.createdAt, new Date(now.getTime() - KEEP_SECONDS * 1000)));

    const inWindow = and(eq(authAttempts.key, key), gt(authAttempts.createdAt, windowStart));
    const [{ used }] = await tx.select({ used: count() }).from(authAttempts).where(inWindow);
    if (used >= limit.max) {
      // Back under the limit once the oldest attempt in the window ages out.
      const [oldest] = await tx
        .select({ createdAt: authAttempts.createdAt })
        .from(authAttempts)
        .where(inWindow)
        .orderBy(asc(authAttempts.createdAt))
        .limit(1);
      const frees = oldest.createdAt.getTime() + limit.windowSeconds * 1000;
      throw new RateLimited(Math.max(1, Math.ceil((frees - now.getTime()) / 1000)));
    }

    await tx.insert(authAttempts).values({ key, createdAt: now });
  });
}

/**
 * This machine: local development and the e2e suite, which signs in far more often than any
 * person. Deployed, the address is the visitor's (Cloudflare's CF-Connecting-IP), never loopback.
 */
export const isLoopback = (ip: string) =>
  ip === '::1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.');

/**
 * `recordAttempt` for a form action: the seconds to wait when the address is over the limit, null
 * when it may go on. Without a database (local preview) nothing is limited.
 */
export async function attemptWait(
  db: AnyDb | null,
  limit: AttemptLimit,
  ip: string,
): Promise<number | null> {
  if (!db || isLoopback(ip)) return null;
  try {
    await recordAttempt(db, limit, ip);
    return null;
  } catch (error) {
    if (error instanceof RateLimited) return error.retryAfterSeconds;
    throw error;
  }
}
