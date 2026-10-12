import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { profiles } from '@mesaaberta/db/schema';
import { can } from '@mesaaberta/core/server/auth/policy';
import {
  connectionStringFrom,
  createDb,
  type DatabaseEnv,
} from '@mesaaberta/core/server/db/client';
import { forceEvent, forceFailedEvents } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { logger } from '@mesaaberta/core/server/logger';

/** What the api Worker is given: the database and the same secrets the handlers need. */
export type ApiEnv = DatabaseEnv & Parameters<typeof handlersFor>[0];

/** The header the web Worker sets, over the Service Binding, with the signed-in admin's id. */
export const ACTOR_HEADER = 'x-actor-id';

type Open = typeof createDb;

/**
 * The admin event actions of Trello #120 ("Rodar agora", "Rodar todos os que falharam"), moved out
 * of the web form actions. The Service Binding is the only way in, but the actor is still checked
 * against the database: the api never trusts a header to say someone is an admin.
 */
export function eventRoutes(open: Open = createDb) {
  const app = new Hono<{
    Bindings: ApiEnv;
    Variables: { db: ReturnType<Open>['db']; actorId: string };
  }>();

  app.use('*', async (c, next) => {
    const actorId = c.req.header(ACTOR_HEADER);
    const connectionString = connectionStringFrom(c.env);
    if (!actorId) return c.json({ error: 'unauthorized' }, 401);
    if (!connectionString) return c.json({ error: 'unavailable' }, 503);

    const { db, close } = open(connectionString);
    try {
      const [actor] = await db
        .select({ id: profiles.id, role: profiles.role, status: profiles.status })
        .from(profiles)
        .where(eq(profiles.id, actorId));
      if (!can(actor ?? null, 'admin:access')) return c.json({ error: 'forbidden' }, 403);
      c.set('db', db);
      c.set('actorId', actorId);
      await next();
    } finally {
      await close().catch(() => undefined);
    }
  });

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
