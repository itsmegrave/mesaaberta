import { Hono } from 'hono';
import { createDb, type DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { forceEvent, forceFailedEvents } from '@mesaaberta/core/server/events/dispatcher';
import { eventQueue, reviewEvent } from '@mesaaberta/core/server/admin/event-queue';
import { eventFilters } from '@mesaaberta/core/admin/event-filters';
import { EVENT_REVIEWS, type EventReview } from '@mesaaberta/core/admin/event-status';
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

  // The queue page: the events for the filters in the query string, with what each handler did (a
  // page past the last is a 404).
  app.get('/', async (c) => {
    const queue = await eventQueue(
      c.get('db'),
      c.get('actor'),
      handlersFor(c.env),
      eventFilters(new URL(c.req.url).searchParams),
      new Date(),
    );
    return queue ? c.json(queue) : c.json({ error: 'not_found' }, 404);
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

  app.post('/:id/review/:review', async (c) => {
    const review = c.req.param('review') as EventReview;
    if (!EVENT_REVIEWS.includes(review)) return c.json({ error: 'invalid_review' }, 400);
    const outcome = await reviewEvent(c.get('db'), c.get('actor'), c.req.param('id'), review);
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
