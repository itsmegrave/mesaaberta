import { Hono } from 'hono';
import type { ZodType } from 'zod';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { tableLifecycleActions } from '@mesaaberta/core/server/tables/lifecycle-actions';
import { refusal } from './refusal';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

/**
 * The GM's manage-page writes of Trello #120 (publish a draft, "it happened", "it did not",
 * postpone), moved out of the manage page's form actions. Looked up by name in core's
 * `tableLifecycleActions`, the registry the web actions run too. Answers `{ eventIds }` (one) for
 * the web Worker to dispatch, or the refusal the service made.
 */
export function manageRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();

  app.use('*', userGuard(open));

  app.post('/:slug/:action', async (c) => {
    const name = c.req.param('action');
    if (!Object.hasOwn(tableLifecycleActions, name)) return c.json({ error: 'not_found' }, 404);
    const action = tableLifecycleActions[name as keyof typeof tableLifecycleActions] as {
      schema: ZodType;
      apply: (
        db: unknown,
        actor: unknown,
        slug: string,
        data: unknown,
      ) => Promise<{ eventId: string }>;
    };

    const parsed = action.schema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);

    try {
      const { eventId } = await action.apply(
        c.get('db'),
        c.get('actor'),
        c.req.param('slug'),
        parsed.data,
      );
      return c.json({ eventIds: [eventId] });
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  return app;
}
