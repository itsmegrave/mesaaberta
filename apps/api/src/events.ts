import { Hono } from 'hono';
import { createDb, type DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { forceEvent, forceFailedEvents } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { logger } from '@mesaaberta/core/server/logger';
import { adminGuard, type AdminVariables } from './admin-guard';

export { ACTOR_HEADER } from './admin-guard';

/** What the api Worker is given: the database and the same secrets the handlers need. */
export type ApiEnv = DatabaseEnv & Parameters<typeof handlersFor>[0];

type Open = typeof createDb;

/**
 * The admin event actions of Trello #120 ("Rodar agora", "Rodar todos os que falharam"), moved out
 * of the web form actions. The Service Binding is the only way in, but the actor is still checked
 * against the database: the api never trusts a header to say someone is an admin.
 */
export function eventRoutes(open: Open = createDb) {
  const app = new Hono<{ Bindings: ApiEnv; Variables: AdminVariables }>();

  app.use('*', adminGuard(open));

  app.post('/:id/force', async (c) => {
    const db = c.get('db');
    const outcome = await forceEvent(
      db,
      handlersFor(c.env),
      c.req.param('id'),
      c.get('actorId'),
      new Date(),
      logger,
    );
    return c.json({ outcome });
  });

  app.post('/retry-failed', async (c) => {
    const db = c.get('db');
    const result = await forceFailedEvents(
      db,
      handlersFor(c.env),
      c.get('actorId'),
      new Date(),
      logger,
    );
    return c.json(result);
  });

  return app;
}
