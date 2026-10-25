import { Hono } from 'hono';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import {
  extensionById,
  extensions,
  type Extension,
} from '@mesaaberta/core/server/extensions/index';
import { adminGuard, type AdminVariables } from './admin-guard';

type Open = typeof createDb;

/**
 * The admin's hand actions on an installed extension (Trello #120): `POST /:ext/:action`, from that
 * extension's `adminActions`, behind `api_admin_<ext>` on the web side. Mounted at `/v1/admin`
 * after the routes with a path of their own. An action may render nothing and call no network: the
 * web Worker still starts any background work after its response, as before. Answers
 * `{ eventIds: [], ... }`, a 400 for data its schema refuses or a 404 for an extension or action
 * nobody installed.
 */
export function extensionRoutes(open: Open = openDb, installed: readonly Extension[] = extensions) {
  const app = new Hono<{
    Bindings: DatabaseEnv & Record<string, unknown>;
    Variables: AdminVariables;
  }>();

  app.use('*', adminGuard(open));

  app.post('/:ext/:action', async (c) => {
    const actions = extensionById(c.req.param('ext'), installed)?.adminActions;
    const name = c.req.param('action');
    if (!actions || !Object.hasOwn(actions, name)) return c.json({ error: 'not_found' }, 404);
    const action = actions[name];

    const parsed = action.schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);

    const result = await action.apply(c.get('db'), c.env as never, parsed.data as never);
    return c.json({ eventIds: [], ...result });
  });

  return app;
}
