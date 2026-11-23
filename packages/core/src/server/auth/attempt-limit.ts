import { and, asc, count, eq, gt, lt, sql } from 'drizzle-orm';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { authAttempts } from '@mesaaberta/core/server/db/schema';
import { RateLimited } from '@mesaaberta/core/server/errors';
import { groupsOfV6 } from '../crowdfunding/address';

/**
 * Limits on the forms anyone can use without an account (sign in, sign up, password reset), per
 * network, so a script cannot guess passwords or send reset e-mails in a loop before it ever reaches
 * Supabase Auth. The per-person limits in rate-limit.ts need a signed-in actor; these count by IP.
 *
 * Generous on purpose: a family, a school or a phone carrier (CGNAT) shares one address, and a
 * person who mistypes a password a few times must not be locked out. A script is far faster.
 */
export type AttemptLimit = {
  action: 'sign_in' | 'sign_up' | 'password_reset' | 'cep_lookup' | 'sign_in_failed_account';
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

/**
 * Wrong passwords for one e-mail, from any address: a script spread over many networks still gets
 * only this many guesses at one account. Only failures count, so the owner signing in is never
 * what locks them out, and a locked account can still come in by passkey, provider or reset link.
 */
export const SIGN_IN_ACCOUNT_LIMIT = {
  action: 'sign_in_failed_account',
  max: 20,
  windowSeconds: 60 * 60,
} as const satisfies AttemptLimit;

/** No limit looks back further than this, so older rows are deleted: the IP is personal data. */
const KEEP_SECONDS = 24 * 60 * 60;

const expiredBefore = (now: Date) =>
  lt(authAttempts.createdAt, new Date(now.getTime() - KEEP_SECONDS * 1000));

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
    // Only this key's old rows: the rest of the table is the sweeper's (`pruneAuthAttempts`), so a
    // burst of sign-ins does not turn into a burst of table-wide deletes.
    await tx.delete(authAttempts).where(and(eq(authAttempts.key, key), expiredBefore(now)));

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
 * Deletes every attempt older than a day, whatever its address. Run by the sweeper, so an address
 * that never comes back is not kept longer than that. Returns how many were deleted.
 */
export async function pruneAuthAttempts(db: AnyDb, now: Date = new Date()): Promise<number> {
  const deleted = await db
    .delete(authAttempts)
    .where(expiredBefore(now))
    .returning({ id: authAttempts.id });
  return deleted.length;
}

/**
 * This machine: local development and the e2e suite, which signs in far more often than any
 * person. Deployed, the address is the visitor's (Cloudflare's CF-Connecting-IP), never loopback.
 */
export const isLoopback = (ip: string) =>
  ip === '::1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.');

/**
 * The network an address stands for. An IPv6 visitor usually holds a whole /64 and can pick a new
 * address in it for every request, so IPv6 counts by its first four groups; IPv4 by the address.
 */
export function networkOf(ip: string): string {
  if (!ip.includes(':')) return ip;
  const groups = groupsOfV6(ip.toLowerCase());
  if (!groups) return ip;
  const first5Zero = groups.slice(0, 5).every((group) => group === 0);
  // An IPv4 address written as IPv6 (::ffff:a.b.c.d) is that IPv4 address.
  if (first5Zero && groups[5] === 0xffff)
    return `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(':')}::/64`;
}

/** The e-mail as a count key: one account however it is typed. */
const accountOf = (email: string) => email.trim().toLowerCase();

/**
 * The seconds to wait before another sign-in to `email`, when it already had `limit.max` wrong
 * passwords in the window, else null. Only reads: `recordSignInFailure` counts the failures.
 */
export async function accountWait(
  db: AnyDb | null,
  limit: AttemptLimit,
  email: string,
  now: Date = new Date(),
): Promise<number | null> {
  if (!db) return null;
  const key = await attemptKey(limit.action, accountOf(email));
  const windowStart = new Date(now.getTime() - limit.windowSeconds * 1000);
  const inWindow = and(eq(authAttempts.key, key), gt(authAttempts.createdAt, windowStart));
  const [{ used }] = await db.select({ used: count() }).from(authAttempts).where(inWindow);
  if (used < limit.max) return null;
  const [oldest] = await db
    .select({ createdAt: authAttempts.createdAt })
    .from(authAttempts)
    .where(inWindow)
    .orderBy(asc(authAttempts.createdAt))
    .limit(1);
  const frees = (oldest?.createdAt.getTime() ?? now.getTime()) + limit.windowSeconds * 1000;
  return Math.max(1, Math.ceil((frees - now.getTime()) / 1000));
}

/** Counts one wrong password for `email` (see `accountWait`). Never throws for the limit. */
export async function recordSignInFailure(
  db: AnyDb | null,
  limit: AttemptLimit,
  email: string,
  now: Date = new Date(),
): Promise<void> {
  if (!db) return;
  try {
    await recordAttempt(db, limit, accountOf(email), now);
  } catch (error) {
    if (!(error instanceof RateLimited)) throw error;
  }
}

/**
 * `recordAttempt` for a form action: the seconds to wait when the network is over the limit, null
 * when it may go on. Without a database (local preview) nothing is limited.
 */
export async function attemptWait(
  db: AnyDb | null,
  limit: AttemptLimit,
  ip: string,
): Promise<number | null> {
  if (!db || isLoopback(ip)) return null;
  try {
    await recordAttempt(db, limit, networkOf(ip));
    return null;
  } catch (error) {
    if (error instanceof RateLimited) return error.retryAfterSeconds;
    throw error;
  }
}
