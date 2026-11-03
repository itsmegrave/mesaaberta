import { Hono } from 'hono';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { readTableCalendar } from '@mesaaberta/core/server/calendar/table';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

/**
 * "Adicionar à agenda" on a table's page: the table as the invite carries it, for web to write as
 * `.ics`. Only its GM, a confirmed player or an admin, while it is going; anyone else is a 404, so
 * the route says nothing about a table they cannot add. `use_table_calendar` is checked by web.
 */
export function tableCalendarRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();
  app.use('*', userGuard(open));

  app.get('/:slug', async (c) => {
    const table = await readTableCalendar(c.get('db'), c.get('actor'), c.req.param('slug'));
    return table ? c.json(table) : c.json({ error: 'not_found' }, 404);
  });

  return app;
}
