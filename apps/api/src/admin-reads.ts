import { Hono } from 'hono';
import { createDb, type DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { adminOverview } from '@mesaaberta/core/server/admin/queries';
import { listAdminProfiles } from '@mesaaberta/core/server/admin/profiles';
import { listAdminTables } from '@mesaaberta/core/server/admin/tables';
import { adminGuard, type AdminVariables } from './admin-guard';

type Open = typeof createDb;

/**
 * The admin side of the read side (Trello #120): `GET /v1/admin-reads/overview`, `users` and
 * `tables` answer the JSON the web app's readers of the same name build in-process, behind
 * `api_reads_admin`, `api_reads_admin_users` and `api_reads_admin_tables`. The actor is checked
 * against the database by the admin guard; the list filters travel as the query string web got, and
 * the pictures stay storage paths (web builds the URLs).
 */
export function adminReadRoutes(open: Open = createDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: AdminVariables }>();

  app.use('*', adminGuard(open));

  app.get('/overview', async (c) => c.json(await adminOverview(c.get('db'))));

  app.get('/users', async (c) =>
    c.json(await listAdminProfiles(c.get('db'), new URL(c.req.url).searchParams)),
  );

  app.get('/tables', async (c) =>
    c.json(await listAdminTables(c.get('db'), new URL(c.req.url).searchParams)),
  );

  return app;
}
