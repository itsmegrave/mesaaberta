import { Hono } from 'hono';
import { credentialsSchema, emailSchema } from '@mesaaberta/core/auth/credentials';
import { createDb as openDb, connectionStringFrom } from '@mesaaberta/core/server/db/client';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import {
  PASSWORD_RESET_LIMIT,
  SIGN_IN_LIMIT,
  attemptWait,
} from '@mesaaberta/core/server/auth/attempt-limit';
import { signInForSession, type SignInResult } from '@mesaaberta/core/server/auth/email';
import { requestPasswordReset } from '@mesaaberta/core/server/auth/password';
import { logger } from '@mesaaberta/core/server/logger';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

type Open = typeof createDb;
type MakeSupabase = (url: string, key: string) => SupabaseClient;
type Env = DatabaseEnv & { SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string };

/** The header the web Worker sends the visitor's address in; like `x-actor-id`, only a claim. */
export const CLIENT_IP_HEADER = 'x-client-ip';

/**
 * The anonymous auth forms of Trello #120, moved out of the web Worker one at a time, behind
 * `api_auth`. There is no actor here: the visitor has no account yet, so these routes are guarded by
 * the Service Binding (or the shared secret over HTTP) alone, and by the per-network limits the web
 * form already applied. Nothing here sets a session; the forms that do (sign in, sign up, choosing a
 * new password) stay in the web Worker until a session hand-off is designed.
 *
 * `POST /sign-in` checks the e-mail and password with Supabase (behind `api_auth_sign_in`) and
 * answers `{ result, session }`. `session` is the JWT pair Supabase issued (`accessToken`,
 * `refreshToken`), present only when `result` is `ok`: the web Worker sets it as the person's
 * cookie session, the only place a session lives. It is never logged and only the Service Binding
 * (or the shared secret) can reach this route. Refusals are `invalid` and `unconfirmed` (400),
 * `suspended` (403), `rate_limited` (429, with `retryAfter`) and `failed` (500).
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

export function authRoutes(open: Open = openDb, makeSupabase: MakeSupabase = statelessClient) {
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

  return app;
}
