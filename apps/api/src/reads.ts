import { Hono } from 'hono';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { readCatalog } from '@mesaaberta/core/server/reads/catalog';
import { readTables } from '@mesaaberta/core/server/reads/tables';
import { readTableFilters } from '@mesaaberta/core/tables/filters';
import { readPreview } from '@mesaaberta/core/server/reads/preview';
import { readDashboard } from '@mesaaberta/core/server/reads/dashboard';
import { readDetail } from '@mesaaberta/core/server/reads/detail';
import { readManage } from '@mesaaberta/core/server/reads/manage';
import { readEditCatalog } from '@mesaaberta/core/server/reads/edit-catalog';
import { viewerTimezone } from '@mesaaberta/core/time/timezone';
import { refusal } from './refusal';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

/**
 * The read side of Trello #120, one resource at a time: `GET /v1/reads/:resource` answers the JSON
 * the web app's reader of the same name builds in-process today, so a page can switch between the
 * two with a flag. The subject is always the actor the web Worker names, never a query parameter.
 * Today: `catalog`, `dashboard`, `detail/:slug`, `edit-catalog/:slug`, `manage/:slug`, `preview` and `tables`, each behind its `api_reads_*` flag.
 */
export function readRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();

  app.use('*', userGuard(open));

  app.get('/catalog', async (c) => c.json(await readCatalog(c.get('db'), c.get('actorId'))));

  app.get('/preview', async (c) => c.json(await readPreview(c.get('db'), new Date())));

  app.get('/tables', async (c) =>
    c.json(
      // The same validation web ran: what is not a filter is dropped, not refused.
      await readTables(c.get('db'), await readTableFilters(new URL(c.req.url)), new Date()),
    ),
  );

  app.get('/edit-catalog/:slug', async (c) => {
    // The zone web resolved for this person (profile, else browser); an unknown one reads as the default.
    const { timezone } = viewerTimezone(c.req.query('tz'), null);
    try {
      return c.json(
        await readEditCatalog(c.get('db'), c.get('actor'), c.req.param('slug'), timezone),
      );
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  app.get('/dashboard', async (c) => {
    // Always the actor's own tables. A page past the last is a 404: web then answers its own.
    const dashboard = await readDashboard(
      c.get('db'),
      c.get('actorId'),
      c.req.query('page') ?? null,
      new Date(),
    );
    return dashboard ? c.json(dashboard) : c.json({ error: 'not_found' }, 404);
  });

  app.get('/detail/:slug', async (c) => {
    // An unknown, disabled or someone else's draft table is a 404: web then answers its own.
    const detail = await readDetail(c.get('db'), c.get('actor'), c.req.param('slug'), new Date());
    return detail ? c.json(detail) : c.json({ error: 'not_found' }, 404);
  });

  app.get('/manage/:slug', async (c) => {
    try {
      return c.json(await readManage(c.get('db'), c.get('actor'), c.req.param('slug'), new Date()));
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  return app;
}
