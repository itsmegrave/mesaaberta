import { Hono } from 'hono';
import type { ZodType } from 'zod';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { accountActions } from '@mesaaberta/core/server/account/actions';
import { refusal } from './refusal';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

/**
 * The signed-in person's own profile writes of Trello #120 (the profile form and the direct
 * messages switch), moved out of `/account/profile`. Looked up by name in core's `accountActions`.
 * The subject is always the actor, never an id from the body. Answers `{ eventIds: [] }` (the
 * events these write are swept) or the refusal the service made.
 */
export function accountRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();

  app.use('*', userGuard(open));

  app.post('/:action', async (c) => {
    const name = c.req.param('action');
    if (!Object.hasOwn(accountActions, name)) return c.json({ error: 'not_found' }, 404);
    const action = accountActions[name as keyof typeof accountActions] as {
      schema: ZodType;
      prepare: (db: unknown, actor: unknown, body: Record<string, unknown>) => Promise<unknown>;
      apply: (db: unknown, actor: unknown, data: unknown) => Promise<void>;
    };

    const body = await c.req.json().catch(() => null);
    if (body === null || typeof body !== 'object' || Array.isArray(body))
      return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);

    try {
      const prepared = await action.prepare(c.get('db'), c.get('actor'), body);
      const parsed = action.schema.safeParse(prepared);
      if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);
      await action.apply(c.get('db'), c.get('actor'), parsed.data);
      return c.json({ eventIds: [] });
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  return app;
}
