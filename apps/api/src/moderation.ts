import { Hono } from 'hono';
import type { ZodType } from 'zod';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { Forbidden, Invalid, NotFound, RateLimited } from '@mesaaberta/core/server/errors';
import { moderationDecisions } from '@mesaaberta/core/server/moderation/decisions';
import { adminGuard, type AdminVariables } from './admin-guard';

type Open = typeof createDb;

/**
 * The admin moderation decisions of Trello #120 (report review, accept, dismiss, close table,
 * take down a campaign or partner, ban and revoke, approve a partner, close a table), moved out of
 * the web form actions. The decision is looked up by name in core's `moderationDecisions`, the
 * same registry the web actions run, with the form's own schema. Answers `{ eventIds }` for the
 * web Worker to dispatch after its response, or what the service refused: 400 `invalid` (with the
 * field and code), 403 `forbidden`, 404 `not_found`, 429 `rate_limited`.
 */
export function moderationRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: AdminVariables }>();

  app.use('*', adminGuard(open));

  app.post('/:decision', async (c) => {
    const name = c.req.param('decision');
    if (!Object.hasOwn(moderationDecisions, name)) return c.json({ error: 'not_found' }, 404);
    const decision = moderationDecisions[name as keyof typeof moderationDecisions] as {
      schema: ZodType;
      apply: (db: unknown, actor: unknown, data: unknown) => Promise<string | string[]>;
    };

    const parsed = decision.schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);

    try {
      const written = await decision.apply(c.get('db'), c.get('actor'), parsed.data);
      return c.json({ eventIds: Array.isArray(written) ? written : [written] });
    } catch (error) {
      if (error instanceof Invalid)
        return c.json({ error: 'invalid', field: error.field, message: error.message }, 400);
      if (error instanceof RateLimited) return c.json({ error: 'rate_limited' }, 429);
      if (error instanceof Forbidden) return c.json({ error: 'forbidden' }, 403);
      if (error instanceof NotFound) return c.json({ error: 'not_found' }, 404);
      throw error;
    }
  });

  return app;
}
