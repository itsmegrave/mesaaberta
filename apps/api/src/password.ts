import { Hono } from 'hono';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { addPasswordSchema } from '@mesaaberta/core/auth/password-setup';
import { addPassword, requestPasswordCode } from '@mesaaberta/core/server/auth/password-setup';
import { logger } from '@mesaaberta/core/server/logger';
import { mailConfigured, mailerFor, type MailEnv } from '@mesaaberta/core/server/mail/index';
import type { Mailer } from '@mesaaberta/core/server/mail/mailer';
import { refusal } from './refusal';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;
type Env = DatabaseEnv &
  Partial<MailEnv> & { SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string };

/** What a test swaps: the e-mail transport and the HTTP client that reaches Supabase Auth. */
export type PasswordDeps = { mailer?: Mailer; request?: typeof fetch };

/**
 * Adding a password to an account that signed in with a provider (Trello #120), moved out of the
 * web Worker's profile page. Two steps: `POST /code` e-mails a six-digit code, `POST /` checks it
 * and sets the password. The web Worker forwards the person's own access token in `Authorization`;
 * Supabase vouches for it and the api checks it belongs to the actor, so the password is set as the
 * person and no Auth secret key lives here. Refusals are the domain's, as everywhere else.
 */
export function passwordRoutes(open: Open = openDb, deps: PasswordDeps = {}) {
  const app = new Hono<{ Bindings: Env; Variables: UserVariables }>();

  app.use('*', userGuard(open));

  const setup = (c: { env: Env; req: { header: (name: string) => string | undefined } }) => {
    const token = /^Bearer (.+)$/.exec(c.req.header('authorization') ?? '')?.[1];
    const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key } = c.env;
    if (!token || !url || !key) return null;
    const mailer =
      deps.mailer ??
      (mailConfigured(c.env) ? mailerFor(c.env as MailEnv, deps.request ?? fetch) : null);
    return mailer ? { token, auth: { url, key, request: deps.request }, mailer } : null;
  };

  app.post('/code', async (c) => {
    const ready = setup(c);
    if (!ready) return c.json({ error: 'unavailable' }, 503);

    try {
      await requestPasswordCode(
        { db: c.get('db'), auth: ready.auth, mailer: ready.mailer, log: logger },
        { profileId: c.get('actorId'), token: ready.token },
      );
      return c.json({ eventIds: [] });
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  app.post('/', async (c) => {
    const ready = setup(c);
    if (!ready) return c.json({ error: 'unavailable' }, 503);

    const body = await c.req.json().catch(() => null);
    const parsed = addPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? '');
      return c.json({ error: 'invalid', field, message: 'invalid' }, 400);
    }

    try {
      await addPassword(
        { db: c.get('db'), auth: ready.auth, mailer: ready.mailer, log: logger },
        { profileId: c.get('actorId'), token: ready.token, ...parsed.data },
      );
      return c.json({ eventIds: [] });
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  return app;
}
