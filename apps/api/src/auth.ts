import { Hono } from 'hono';
import {
  credentialsSchema,
  emailSchema,
  newPasswordSchema,
} from '@mesaaberta/core/auth/credentials';
import { createDb as openDb, connectionStringFrom } from '@mesaaberta/core/server/db/client';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import {
  PASSWORD_RESET_LIMIT,
  SIGN_IN_LIMIT,
  SIGN_UP_LIMIT,
  attemptWait,
} from '@mesaaberta/core/server/auth/attempt-limit';
import { completeLogin } from '@mesaaberta/core/server/auth/login';
import {
  signInForSession,
  signUpForSession,
  type SignInResult,
  type SignUpResult,
} from '@mesaaberta/core/server/auth/email';
import {
  changePasswordWithToken,
  requestPasswordReset,
  type ChangePasswordResult,
} from '@mesaaberta/core/server/auth/password';
import { logger } from '@mesaaberta/core/server/logger';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

type Open = typeof createDb;
type MakeSupabase = (url: string, key: string) => SupabaseClient;
type Env = DatabaseEnv & { SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string };

/** The header the web Worker sends the visitor's address in; like `x-actor-id`, only a claim. */
export const CLIENT_IP_HEADER = 'x-client-ip';

/**
 * The auth forms of Trello #120: the web Worker has no fallback for them. There is no actor here:
 * the visitor has no account yet, so these routes are guarded by the Service Binding (or the shared
 * secret over HTTP) alone, and by the per-network limits applied here. Nothing here sets a cookie:
 * the forms that sign someone in answer the JWT pair and the web Worker sets it as the session.
 *
 * `POST /sign-in` checks the e-mail and password with Supabase and
 * answers `{ result, session }`. `session` is the JWT pair Supabase issued (`accessToken`,
 * `refreshToken`), present only when `result` is `ok`: the web Worker sets it as the person's
 * cookie session, the only place a session lives. It is never logged and only the Service Binding
 * (or the shared secret) can reach this route. Refusals are `invalid` and `unconfirmed` (400),
 * `suspended` (403), `rate_limited` (429, with `retryAfter`) and `failed` (500).
 *
 * `POST /sign-up` creates the account from `{ email, password, origin,
 * next }` and answers `{ result, session }`: `signed_in` with the JWT pair when no confirmation is
 * needed, `check_email` (also for an address that already has an account) without one; refusals are
 * `weak_password` (400), `rate_limited` (429, with `retryAfter`) and `failed` (500).
 *
 * `POST /new-password` sets `{ password, passwordConfirm }` for the
 * person whose own access token comes in `Authorization: Bearer`, and signs their other sessions out.
 * The token alone says whose password changes; Supabase checks it. Answers `{ result }`: `ok`, or
 * `weak_password` / `same_password` (400), `no_session` (401), `rate_limited` (429), `failed` (500).
 *
 * `POST /finish-login` is the database half of a provider sign-in:
 * the web Worker has traded the code for a session and forwards the new access token in
 * `Authorization`; Supabase vouches for it, then the api ensures the profile, refuses a banned
 * account, records the connection (the visitor's address in `x-client-ip`) and answers
 * `{ result: 'ok', target }` or `{ result: 'profile_failed' | 'suspended' }` (the web Worker signs the
 * person out on those). Body: `{ next }`.
 *
 * `POST /password-reset` e-mails a reset link. Answers `{ result }`: `sent` (whether or not the
 * address has an account), `rate_limited` (429, with `retryAfter` when it is our limit) or `failed`.
 */
const statelessClient: MakeSupabase = (url, key) =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

/** The status the sign-in form shows for each refusal; the same as the web action's. */
const SIGN_IN_STATUS = {
  invalid: 400,
  unconfirmed: 400,
  suspended: 403,
  failed: 500,
  rate_limited: 429,
} as const satisfies Record<Exclude<SignInResult, 'ok'>, number>;

/** The status the new-password form shows for each refusal; the same as the web action's. */
const NEW_PASSWORD_STATUS = {
  weak_password: 400,
  same_password: 400,
  no_session: 401,
  rate_limited: 429,
  failed: 500,
} as const satisfies Record<Exclude<ChangePasswordResult, 'ok'>, number>;

/** The status the sign-up form shows for each refusal; the same as the web action's. */
const SIGN_UP_STATUS = {
  weak_password: 400,
  failed: 500,
  rate_limited: 429,
} as const satisfies Record<Exclude<SignUpResult, 'signed_in' | 'check_email'>, number>;

export function authRoutes(
  open: Open = openDb,
  makeSupabase: MakeSupabase = statelessClient,
  deps: { request?: typeof fetch } = {},
) {
  const app = new Hono<{ Bindings: Env }>();

  app.post('/password-reset', async (c) => {
    const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key } = c.env;
    const connectionString = connectionStringFrom(c.env);
    if (!url || !key || !connectionString) return c.json({ error: 'unavailable' }, 503);

    const body = (await c.req.json().catch(() => null)) as {
      email?: unknown;
      origin?: unknown;
    } | null;
    const parsed = emailSchema.safeParse({ email: body?.email });
    const origin = typeof body?.origin === 'string' ? body.origin : '';
    if (!parsed.success || !/^https?:\/\/[^/]+$/.test(origin))
      return c.json({ error: 'invalid', field: 'email', message: 'invalid' }, 400);

    const { db, close } = open(connectionString);
    try {
      // Each request sends an e-mail: without a limit, a script could flood someone's inbox.
      const wait = await attemptWait(
        db,
        PASSWORD_RESET_LIMIT,
        c.req.header(CLIENT_IP_HEADER) ?? '',
      );
      if (wait !== null) return c.json({ result: 'rate_limited', retryAfter: wait }, 429);

      const supabase = makeSupabase(url, key);
      const result = await requestPasswordReset(
        { supabase, log: logger },
        { email: parsed.data.email, origin },
      );
      return c.json({ result }, result === 'sent' ? 200 : result === 'rate_limited' ? 429 : 502);
    } finally {
      await close();
    }
  });

  app.post('/sign-in', async (c) => {
    const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key } = c.env;
    const connectionString = connectionStringFrom(c.env);
    if (!url || !key || !connectionString) return c.json({ error: 'unavailable' }, 503);

    const body = (await c.req.json().catch(() => null)) as {
      email?: unknown;
      password?: unknown;
    } | null;
    const parsed = credentialsSchema.safeParse({ email: body?.email, password: body?.password });
    if (!parsed.success) return c.json({ error: 'invalid', message: 'invalid' }, 400);

    const ip = c.req.header(CLIENT_IP_HEADER) ?? '';
    const { db, close } = open(connectionString);
    try {
      // Counted per network before Supabase sees it, so a script cannot guess passwords in a loop.
      const wait = await attemptWait(db, SIGN_IN_LIMIT, ip);
      if (wait !== null) return c.json({ result: 'rate_limited', retryAfter: wait }, 429);

      const { result, session } = await signInForSession(
        { supabase: makeSupabase(url, key), db, log: logger, ip: ip || null },
        parsed.data,
      );
      if (result !== 'ok') return c.json({ result }, SIGN_IN_STATUS[result]);
      return c.json({ result, session });
    } finally {
      await close();
    }
  });

  app.post('/sign-up', async (c) => {
    const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key } = c.env;
    const connectionString = connectionStringFrom(c.env);
    if (!url || !key || !connectionString) return c.json({ error: 'unavailable' }, 503);

    const body = (await c.req.json().catch(() => null)) as {
      email?: unknown;
      password?: unknown;
      origin?: unknown;
      next?: unknown;
    } | null;
    const parsed = credentialsSchema.safeParse({ email: body?.email, password: body?.password });
    const origin = typeof body?.origin === 'string' ? body.origin : '';
    if (!parsed.success || !/^https?:\/\/[^/]+$/.test(origin))
      return c.json({ error: 'invalid', message: 'invalid' }, 400);
    const next = typeof body?.next === 'string' ? body.next : null;

    const ip = c.req.header(CLIENT_IP_HEADER) ?? '';
    const { db, close } = open(connectionString);
    try {
      const wait = await attemptWait(db, SIGN_UP_LIMIT, ip);
      if (wait !== null) return c.json({ result: 'rate_limited', retryAfter: wait }, 429);

      const { result, session } = await signUpForSession(
        { supabase: makeSupabase(url, key), db, log: logger, ip: ip || null },
        { email: parsed.data.email, password: parsed.data.password, origin, next },
      );
      if (result === 'signed_in') return c.json({ result, session });
      if (result === 'check_email') return c.json({ result });
      return c.json({ result }, SIGN_UP_STATUS[result]);
    } finally {
      await close();
    }
  });

  app.post('/new-password', async (c) => {
    const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key } = c.env;
    if (!url || !key) return c.json({ error: 'unavailable' }, 503);

    const token = /^Bearer (.+)$/.exec(c.req.header('authorization') ?? '')?.[1];
    if (!token) return c.json({ result: 'no_session' }, 401);
    const body = (await c.req.json().catch(() => null)) as {
      password?: unknown;
      passwordConfirm?: unknown;
    } | null;
    const parsed = newPasswordSchema.safeParse({
      password: body?.password,
      passwordConfirm: body?.passwordConfirm,
    });
    if (!parsed.success) return c.json({ error: 'invalid', message: 'invalid' }, 400);

    const result = await changePasswordWithToken(
      { url, key, request: deps.request, log: logger },
      { token, password: parsed.data.password },
    );
    if (result === 'ok') return c.json({ result });
    return c.json({ result }, NEW_PASSWORD_STATUS[result]);
  });

  app.post('/finish-login', async (c) => {
    const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key } = c.env;
    const connectionString = connectionStringFrom(c.env);
    if (!url || !key || !connectionString) return c.json({ error: 'unavailable' }, 503);

    const token = /^Bearer (.+)$/.exec(c.req.header('authorization') ?? '')?.[1];
    if (!token) return c.json({ result: 'no_session' }, 401);
    const body = (await c.req.json().catch(() => null)) as { next?: unknown } | null;
    const next = typeof body?.next === 'string' ? body.next : null;

    // Whoever the token belongs to, checked by Supabase: it says whose profile this is.
    let user: { id?: string; user_metadata?: Record<string, unknown> } | null;
    try {
      const response = await (deps.request ?? fetch)(`${url.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { apikey: key, authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 401 || response.status === 403)
        return c.json({ result: 'no_session' }, 401);
      if (!response.ok) return c.json({ result: 'failed' }, 502);
      user = await response.json();
    } catch {
      return c.json({ result: 'failed' }, 502);
    }
    if (!user?.id) return c.json({ result: 'failed' }, 502);

    const ip = c.req.header(CLIENT_IP_HEADER) ?? '';
    const { db, close } = open(connectionString);
    try {
      const done = await completeLogin(
        { db, log: logger, ip: ip || null },
        { id: user.id, user_metadata: user.user_metadata },
        next,
      );
      return c.json(done, done.result === 'ok' ? 200 : done.result === 'suspended' ? 403 : 500);
    } finally {
      await close();
    }
  });

  return app;
}
