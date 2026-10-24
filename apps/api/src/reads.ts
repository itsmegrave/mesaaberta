import { Hono } from 'hono';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { readCatalog } from '@mesaaberta/core/server/reads/catalog';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

/**
 * The read side of Trello #120, one resource at a time: `GET /v1/reads/:resource` answers the JSON
 * the web app's reader of the same name builds in-process today, so a page can switch between the
 * two with a flag. The subject is always the actor the web Worker names, never a query parameter.
 * Today: `catalog`, behind `api_reads_catalog`.
 */
export function readRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();

  app.use('*', userGuard(open));

  app.get('/catalog', async (c) => c.json(await readCatalog(c.get('db'), c.get('actorId'))));

  return app;
}
