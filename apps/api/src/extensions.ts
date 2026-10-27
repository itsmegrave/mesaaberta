import { Hono } from 'hono';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { connectionStringFrom, createDb as openDb } from '@mesaaberta/core/server/db/client';
import { logger } from '@mesaaberta/core/server/logger';
import { socialFor, type SocialEnv } from '@mesaaberta/core/server/social/index';
import {
  extensionById,
  extensions,
  type Extension,
} from '@mesaaberta/core/server/extensions/index';
import { adminGuard, type AdminVariables } from './admin-guard';
import { afterAnswer, apiFlags, type FlagsEnv } from './flags';

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

  // An extension's panel on the admin's connections page: its own data, never a token or a secret.
  app.get('/:ext/panel', async (c) => {
    const admin = extensionById(c.req.param('ext'), installed)?.admin;
    if (!admin) return c.json({ error: 'not_found' }, 404);
    return c.json({ panel: await admin.load(c.get('db'), c.env as never) });
  });

  // "Publicar no Instagram" after `queue` answered `queued`: the render and the publish run after
  // the answer, on a connection of their own. Failures are recorded on the durable job; never log
  // Meta payloads.
  app.post('/social/publish', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { tableId?: unknown } | null;
    const tableId = typeof body?.tableId === 'string' ? body.tableId : '';
    if (!/^[0-9a-f-]{36}$/i.test(tableId))
      return c.json({ error: 'invalid', field: 'tableId', message: 'invalid' }, 400);
    const env = c.env as SocialEnv & DatabaseEnv;
    const social = socialFor(env, installed);
    const connectionString = connectionStringFrom(env)!;
    afterAnswer(
      c,
      (async () => {
        const { db, close } = open(connectionString);
        try {
          const useTableImage = await apiFlags(c.env as FlagsEnv).isEnabled('use_table_image');
          await social.publishTable(db, env, tableId, new Date(), { useTableImage });
        } catch {
          logger.error('instagram.background_publish_failed', { tableId });
        } finally {
          await close().catch(() => undefined);
        }
      })(),
    );
    return c.json({ eventIds: [] }, 202);
  });

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
