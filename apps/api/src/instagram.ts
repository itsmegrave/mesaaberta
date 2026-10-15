import { Hono } from 'hono';
import type { ZodType } from 'zod';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import type { InstagramEnv } from '@mesaaberta/core/server/instagram/api';
import { instagramAdminActions } from '@mesaaberta/core/server/instagram/admin-actions';
import type { SocialEnv } from '@mesaaberta/core/server/social/index';
import { adminGuard, type AdminVariables } from './admin-guard';

type Open = typeof createDb;
type Env = DatabaseEnv & InstagramEnv & SocialEnv;

/**
 * The admin's hand actions on Instagram posts (Trello #120): `POST /queue` and `POST /reconcile`,
 * from core's `instagramAdminActions`. Neither renders an image or calls Meta: queueing is the
 * durable job and reconciling is a status change, so the web Worker still starts the background
 * publish after its response, as before. Answers `{ eventIds: [], ... }` or a 400.
 */
export function instagramRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: Env; Variables: AdminVariables }>();

  app.use('*', adminGuard(open));

  app.post('/:action', async (c) => {
    const name = c.req.param('action');
    if (!Object.hasOwn(instagramAdminActions, name)) return c.json({ error: 'not_found' }, 404);
    const action = instagramAdminActions[name as keyof typeof instagramAdminActions] as {
      schema: ZodType;
      apply: (db: unknown, env: unknown, data: unknown) => Promise<Record<string, unknown>>;
    };

    const parsed = action.schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);

    const result = await action.apply(c.get('db'), c.env, parsed.data);
    return c.json({ eventIds: [], ...result });
  });

  return app;
}
