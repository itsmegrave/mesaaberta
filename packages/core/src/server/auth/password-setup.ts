import { and, eq, gt, lt, or, sql } from 'drizzle-orm';
import { passwordSetupCodes } from '../db/schema';
import type { AnyDb } from '../db/client';
import { Forbidden, Invalid, RateLimited } from '../errors';
import type { Logger } from '../logger';
import type { Mailer } from '../mail/mailer';
import { PASSWORD_CODE_LENGTH } from '../../auth/password-setup';

// Adding a password to an account that signed in with a provider. The person proves they own the
// mailbox with a code we e-mail and check ourselves (Supabase only checks its reauthentication nonce
// once the session is a day old), then the password is set with their own access token: no secret
// key is involved, so a request that is not theirs cannot set anyone's password. Neither the code,
// the password nor the address is ever logged.

const CODE_TTL_MS = 10 * 60_000;
const RESEND_AFTER_MS = 60_000;
const MAX_ATTEMPTS = 5;
// A new code does not clear the guesses already spent: after `MAX_ATTEMPTS` the person waits this
// long (from the last code) before another is sent, so asking again is not a way to keep guessing.
const LOCKOUT_MS = 60 * 60_000;

/** The Supabase Auth project and the signed-in person's own access token. */
export type SupabaseAuth = { url: string; key: string; request?: typeof fetch };

type Deps = {
  db: AnyDb;
  auth: SupabaseAuth;
  mailer: Mailer;
  log: Logger;
  now?: () => Date;
};
type Who = { profileId: string; token: string };

type AuthUser = { id: string; email: string | null; hasEmailIdentity: boolean };

const authCall = (
  { url, key, request = fetch }: SupabaseAuth,
  token: string,
  path: string,
  init: RequestInit = {},
) =>
  request(`${url.replace(/\/$/, '')}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  });

/** Whoever the token belongs to, checked by Supabase. Anyone else than `profileId` is `Forbidden`. */
async function userOf(
  auth: SupabaseAuth,
  { profileId, token }: Who,
  log: Logger,
): Promise<AuthUser> {
  const response = await authCall(auth, token, '/user');
  if (response.status === 401 || response.status === 403) throw new Forbidden('no session');
  if (!response.ok) {
    log.warn('password setup: could not read the user', { status: response.status });
    throw new Error(`auth: could not read the user (${response.status})`);
  }

  const user = (await response.json()) as {
    id?: string;
    email?: string | null;
    identities?: Array<{ provider?: string }> | null;
  };
  if (user.id !== profileId) throw new Forbidden('the token is not the actor’s');

  return {
    id: user.id,
    email: user.email ?? null,
    hasEmailIdentity: (user.identities ?? []).some((identity) => identity.provider === 'email'),
  };
}

/** Only an account that cannot sign in with an e-mail and a password yet, and has an address. */
function assertCanAdd(user: AuthUser) {
  if (user.hasEmailIdentity) throw new Invalid('password', 'already_set');
  if (!user.email) throw new Invalid('password', 'no_email');
}

/**
 * The guesses a new code inherits: the old count, or none once the lockout has passed since the last
 * code. The instant is an ISO string with a cast, not a `Date`: in a hand-written `sql` the driver
 * (postgres.js) cannot serialize one (`ERR_INVALID_ARG_TYPE`), which an in-memory test database does
 * not catch.
 */
export const carriedAttempts = (now: Date) =>
  sql`case when ${passwordSetupCodes.sentAt} < ${new Date(now.getTime() - LOCKOUT_MS).toISOString()}::timestamptz then 0 else ${passwordSetupCodes.attempts} end`;

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

/** Keyed by the person, so the same six digits for two people are two different hashes. */
async function hashOf(profileId: string, code: string) {
  return hex(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${profileId}:${code}`)),
  );
}

/** Six uniformly random digits: values above the last whole multiple are drawn again, not folded. */
function newCode() {
  const range = 10 ** PASSWORD_CODE_LENGTH;
  const limit = Math.floor(2 ** 32 / range) * range;
  const draw = new Uint32Array(1);
  do crypto.getRandomValues(draw);
  while (draw[0] >= limit);
  return String(draw[0] % range).padStart(PASSWORD_CODE_LENGTH, '0');
}

function sameHash(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/** The e-mail with the code. Plain text, pt-BR, like the other account mail. */
export function passwordCodeMail(code: string) {
  return {
    subject: 'Seu código para criar uma senha',
    text: [
      'Olá!',
      '',
      `Seu código para criar uma senha na Mesa Aberta é ${code}.`,
      'Ele vale por 10 minutos e só funciona uma vez.',
      '',
      'Se não foi você que pediu, ignore este e-mail: nada na sua conta muda.',
    ].join('\n'),
  };
}

/**
 * E-mails a fresh code to the signed-in person. Asking again replaces the code, no sooner than a
 * minute after the last one (`RateLimited` says how long to wait). `Invalid` when the account
 * already has a password or has no address; `Forbidden` when the token is not `profileId`'s.
 */
export async function requestPasswordCode(deps: Deps, who: Who): Promise<void> {
  const { db, auth, mailer } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const user = await userOf(auth, who, deps.log);
  assertCanAdd(user);

  const code = newCode();
  const codeHash = await hashOf(who.profileId, code);
  const [stored] = await db
    .insert(passwordSetupCodes)
    .values({
      profileId: who.profileId,
      codeHash,
      sentAt: now,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    })
    .onConflictDoUpdate({
      target: passwordSetupCodes.profileId,
      set: {
        codeHash,
        // The guesses carry over to the new code until an hour has passed since the last one.
        attempts: carriedAttempts(now),
        sentAt: now,
        expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      },
      // Only a code at least a minute old is replaced, and not one whose guesses ran out less than
      // an hour ago.
      setWhere: and(
        lt(passwordSetupCodes.sentAt, new Date(now.getTime() - RESEND_AFTER_MS)),
        or(
          lt(passwordSetupCodes.attempts, MAX_ATTEMPTS),
          lt(passwordSetupCodes.sentAt, new Date(now.getTime() - LOCKOUT_MS)),
        ),
      ),
    })
    .returning({ profileId: passwordSetupCodes.profileId });

  if (!stored) {
    const [current] = await db
      .select({ sentAt: passwordSetupCodes.sentAt, attempts: passwordSetupCodes.attempts })
      .from(passwordSetupCodes)
      .where(eq(passwordSetupCodes.profileId, who.profileId));
    const wait = current
      ? Math.ceil(
          (current.sentAt.getTime() +
            (current.attempts >= MAX_ATTEMPTS ? LOCKOUT_MS : RESEND_AFTER_MS) -
            now.getTime()) /
            1000,
        )
      : 60;
    throw new RateLimited(Math.max(1, wait));
  }

  try {
    await mailer.send({
      to: user.email!,
      ...passwordCodeMail(code),
      idempotencyKey: `password-code:${who.profileId}:${codeHash.slice(0, 16)}`,
    });
  } catch (error) {
    deps.log.warn('password setup: the code was not sent', { error });
    // No code the person never received is left to be guessed.
    await db.delete(passwordSetupCodes).where(eq(passwordSetupCodes.profileId, who.profileId));
    throw error;
  }
}

/**
 * Sets the password when `code` is the one that was e-mailed. `Invalid` says what to fix: `code`
 * (`wrong_code`, `code_expired` for a missing, expired or used-up code) or `password`
 * (`weak_password`, `already_set`, `no_email`). `Forbidden` when the token is not `profileId`'s.
 * Signs the person's other sessions out, as a password change always does.
 */
export async function addPassword(
  deps: Deps,
  who: Who & { password: string; code: string },
): Promise<void> {
  const { db, auth, log } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const user = await userOf(auth, who, log);
  assertCanAdd(user);

  // Counted before it is compared, so a guess is spent whether or not it was right.
  const [live] = await db
    .update(passwordSetupCodes)
    .set({ attempts: sql`${passwordSetupCodes.attempts} + 1` })
    .where(
      and(
        eq(passwordSetupCodes.profileId, who.profileId),
        lt(passwordSetupCodes.attempts, MAX_ATTEMPTS),
        gt(passwordSetupCodes.expiresAt, now),
      ),
    )
    .returning({ codeHash: passwordSetupCodes.codeHash });
  if (!live) throw new Invalid('code', 'code_expired');
  if (!sameHash(live.codeHash, await hashOf(who.profileId, who.code)))
    throw new Invalid('code', 'wrong_code');

  const response = await authCall(auth, who.token, '/user', {
    method: 'PUT',
    body: JSON.stringify({ password: who.password }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error_code?: string;
      code?: string;
    };
    const code = body.error_code ?? body.code;
    if (code === 'weak_password' || code === 'same_password') {
      // The code was right: retyping the password must not spend a guess.
      await db
        .update(passwordSetupCodes)
        .set({ attempts: sql`greatest(${passwordSetupCodes.attempts} - 1, 0)` })
        .where(eq(passwordSetupCodes.profileId, who.profileId));
      throw new Invalid('password', 'weak_password');
    }
    if (response.status === 429) throw new RateLimited(60);
    log.warn('password setup: Supabase refused', { code, status: response.status });
    throw new Error(`auth: could not set the password (${response.status})`);
  }

  await db.delete(passwordSetupCodes).where(eq(passwordSetupCodes.profileId, who.profileId));
  // Whoever else is signed in (a stolen session, a forgotten device) is out.
  try {
    await authCall(auth, who.token, '/logout?scope=others', { method: 'POST' });
  } catch (error) {
    log.warn('password setup: could not sign the other sessions out', { error });
  }
}
