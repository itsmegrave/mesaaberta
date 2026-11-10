import { Hono } from 'hono';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { listTools } from '@mesaaberta/core/server/tools/service';
import { viewerGuard, type ViewerVariables } from './user-guard';

type Open = typeof createDb;

/**
 * Ferramentas: the page's list, approved tools grouped by kind plus the viewer's own suggestions
 * that still wait. Suggesting one is `POST /v1/submissions/tools`.
 */
export function toolRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: ViewerVariables }>();
  app.use('*', viewerGuard(open));

  app.get('/', async (c) =>
    c.json(
      await listTools(c.get('db'), {
        viewerId: c.get('actor')?.id ?? null,
        query: (c.req.query('q') ?? '').slice(0, 100),
      }),
    ),
  );

  return app;
}
