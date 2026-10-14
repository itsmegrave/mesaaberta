import { Hono } from 'hono';
import type { ZodType } from 'zod';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import {
  AlreadyRegistered,
  Forbidden,
  Invalid,
  NotFound,
  RateLimited,
  TableFull,
} from '@mesaaberta/core/server/errors';
import { registrationActions } from '@mesaaberta/core/server/registrations/decisions';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

/**
 * The player-facing registration writes of Trello #120 (join, leave, and the GM's approve, decline
 * and remove), moved out of the table page's form actions. The action is looked up by name in
 * core's `registrationActions`, the registry the web actions run too. Answers `{ eventIds }` for
 * the web Worker to dispatch after its response, or the refusal the service made, as the code the
 * web form already shows: 400 `invalid`, 403 `forbidden`, 404 `not_found`, 409 `table_full` or
 * `already_registered`, 429 `rate_limited` with `retryAfter`.
 */
export function registrationRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();

  app.use('*', userGuard(open));

  app.post('/:slug/:action', async (c) => {
    const name = c.req.param('action');
    if (!Object.hasOwn(registrationActions, name)) return c.json({ error: 'not_found' }, 404);
    const action = registrationActions[name as keyof typeof registrationActions] as {
      schema: ZodType;
      apply: (
        db: unknown,
        actor: unknown,
        slug: string,
        data: unknown,
      ) => Promise<{ eventIds: string[] }>;
    };

    const parsed = action.schema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid', field: '' }, 400);

    try {
      const { eventIds } = await action.apply(
        c.get('db'),
        c.get('actor'),
        c.req.param('slug'),
        parsed.data,
      );
      return c.json({ eventIds });
    } catch (error) {
      if (error instanceof Invalid) return c.json({ error: 'invalid', field: error.field }, 400);
      if (error instanceof RateLimited)
        return c.json({ error: 'rate_limited', retryAfter: error.retryAfterSeconds }, 429);
      if (error instanceof Forbidden) return c.json({ error: 'forbidden' }, 403);
      if (error instanceof NotFound) return c.json({ error: 'not_found' }, 404);
      if (error instanceof TableFull) return c.json({ error: 'table_full' }, 409);
      if (error instanceof AlreadyRegistered) return c.json({ error: 'already_registered' }, 409);
      throw error;
    }
  });

  return app;
}
