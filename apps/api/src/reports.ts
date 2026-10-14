import { Hono } from 'hono';
import type { ZodType } from 'zod';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { playerModerationActions } from '@mesaaberta/core/server/moderation/player-actions';
import { refusal } from './refusal';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

/**
 * What a signed-in member does about someone else's table, partner or campaign, and withdrawing
 * their own partner (Trello #120): `POST /:action` with `table`, `partner`, `crowdfunding` or
 * `withdrawPartner`, looked up in core's `playerModerationActions`, the registry the web form
 * actions run. Answers `{ eventIds }` for the web Worker to dispatch, or the refusal the service
 * made (`already_reported`, `rate_limited`, `forbidden`, `not_found`).
 */
export function reportRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();

  app.use('*', userGuard(open));

  app.post('/:action', async (c) => {
    const name = c.req.param('action');
    if (!Object.hasOwn(playerModerationActions, name)) return c.json({ error: 'not_found' }, 404);
    const action = playerModerationActions[name as keyof typeof playerModerationActions] as {
      schema: ZodType;
      apply: (db: unknown, actor: unknown, data: unknown) => Promise<string[]>;
    };

    const parsed = action.schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);

    try {
      return c.json({ eventIds: await action.apply(c.get('db'), c.get('actor'), parsed.data) });
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  return app;
}
