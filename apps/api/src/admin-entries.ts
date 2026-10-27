import { Hono } from 'hono';
import { createDb, type DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { adminSectionOf, recordAdminEntry } from '@mesaaberta/core/server/admin/entries';
import { adminGuard, type AdminVariables } from './admin-guard';

type Open = typeof createDb;

/**
 * `POST /` with `{ route }`: an admin opened a page of the admin area (the web Worker sends the
 * route id after its answer). The section is taken from the route id here, so a user or table id
 * never reaches the log, and one entry per section in half an hour is kept (`recordAdminEntry`).
 * Answers the event, if one was written, for the dispatch after the answer.
 */
export function adminEntryRoutes(open: Open = createDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: AdminVariables }>();

  app.use('*', adminGuard(open));

  app.post('/', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { route?: unknown } | null;
    const route = body?.route;
    if (typeof route !== 'string' || !route.startsWith('/admin') || route.length > 200)
      return c.json({ error: 'invalid', field: 'route', message: 'invalid' }, 400);
    const eventId = await recordAdminEntry(c.get('db'), {
      actorId: c.get('actorId'),
      section: adminSectionOf(route),
    });
    return c.json({ eventIds: eventId ? [eventId] : [] });
  });

  return app;
}
