import { Hono } from 'hono';
import { emailSchema } from '@mesaaberta/core/auth/credentials';
import { createDb as openDb, connectionStringFrom } from '@mesaaberta/core/server/db/client';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { PASSWORD_RESET_LIMIT, attemptWait } from '@mesaaberta/core/server/auth/attempt-limit';
import { requestPasswordReset } from '@mesaaberta/core/server/auth/password';
import { logger } from '@mesaaberta/core/server/logger';
import { createClient } from '@supabase/supabase-js';

type Open = typeof createDb;
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
 * `POST /password-reset` e-mails a reset link. Answers `{ result }`: `sent` (whether or not the
 * address has an account), `rate_limited` (429, with `retryAfter` when it is our limit) or `failed`.
 */
export function authRoutes(open: Open = openDb) {
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

      const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const result = await requestPasswordReset(
        { supabase, log: logger },
        { email: parsed.data.email, origin },
      );
      return c.json({ result }, result === 'sent' ? 200 : result === 'rate_limited' ? 429 : 502);
    } finally {
      await close();
    }
  });

  return app;
}
