import { Hono } from 'hono';
import type { ZodType } from 'zod';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { z } from 'zod';
import { accountActions } from '@mesaaberta/core/server/account/actions';
import { deleteAccount } from '@mesaaberta/core/server/account/delete';
import { supabaseAdminFrom, type SupabaseAdmin } from '@mesaaberta/core/server/auth/admin-client';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { logger } from '@mesaaberta/core/server/logger';
import { refusal } from './refusal';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;
type Env = DatabaseEnv &
  NonNullable<Parameters<typeof handlersFor>[0]> & {
    SUPABASE_URL?: string;
    SUPABASE_SECRET_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  };

/** What a test swaps: the Auth admin client (production builds it from the Worker's secrets). */
export type AccountDeps = { admin?: SupabaseAdmin | null };

/**
 * The signed-in person's own profile writes of Trello #120 (the profile form and the direct
 * messages switch), moved out of `/account/profile`. Looked up by name in core's `accountActions`.
 * The subject is always the actor, never an id from the body. Answers `{ eventIds: [] }` (the
 * events these write are swept) or the refusal the service made.
 */
export function accountRoutes(open: Open = openDb, deps: AccountDeps = {}) {
  const app = new Hono<{ Bindings: Env; Variables: UserVariables }>();

  app.use('*', userGuard(open));

  // Closes the account (tables, seats, calendar cancellations, profile, Auth user). The person typed
  // their username to confirm; it is checked again here against the stored one.
  app.post('/delete', async (c) => {
    const admin = deps.admin === undefined ? supabaseAdminFrom(c.env) : deps.admin;
    if (!admin) return c.json({ error: 'unavailable' }, 503);

    const parsed = z
      .object({ confirm: z.string().max(100) })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      return c.json({ error: 'invalid', field: 'confirm', message: 'confirm' }, 400);

    try {
      await deleteAccount(
        { db: c.get('db'), admin, handlers: handlersFor(c.env), log: logger },
        c.get('actorId'),
        parsed.data.confirm,
      );
      return c.json({ eventIds: [] });
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  app.post('/:action', async (c) => {
    const name = c.req.param('action');
    if (!Object.hasOwn(accountActions, name)) return c.json({ error: 'not_found' }, 404);
    const action = accountActions[name as keyof typeof accountActions] as {
      schema: ZodType;
      prepare: (db: unknown, actor: unknown, body: Record<string, unknown>) => Promise<unknown>;
      apply: (
        db: unknown,
        actor: unknown,
        data: unknown,
      ) => Promise<void | Record<string, unknown>>;
    };

    const body = await c.req.json().catch(() => null);
    if (body === null || typeof body !== 'object' || Array.isArray(body))
      return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);

    try {
      const prepared = await action.prepare(c.get('db'), c.get('actor'), body);
      const parsed = action.schema.safeParse(prepared);
      if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);
      const result = await action.apply(c.get('db'), c.get('actor'), parsed.data);
      return c.json({ eventIds: [], ...(result ?? {}) });
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  return app;
}
