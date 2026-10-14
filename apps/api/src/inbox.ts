import { Hono } from 'hono';
import type { ZodType } from 'zod';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { inboxActions } from '@mesaaberta/core/server/inbox/actions';
import { refusal } from './refusal';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

/**
 * The inbox writes of Trello #120 (send and mute a conversation, open, read and read-all of the
 * notification feed), moved out of `/messages/[id]` and `/notifications`. Looked up by name in
 * core's `inboxActions`. The subject is always the actor. Answers `{ eventIds: [], ...result }`
 * (these write no outbox events) or the refusal the service made.
 */
export function inboxRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();

  app.use('*', userGuard(open));

  app.post('/:action', async (c) => {
    const name = c.req.param('action');
    if (!Object.hasOwn(inboxActions, name)) return c.json({ error: 'not_found' }, 404);
    const action = inboxActions[name as keyof typeof inboxActions] as unknown as {
      schema: ZodType;
      apply: (db: unknown, actor: unknown, data: unknown) => Promise<Record<string, unknown>>;
    };

    const parsed = action.schema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);

    try {
      const result = await action.apply(c.get('db'), c.get('actor'), parsed.data);
      return c.json({ eventIds: [], ...result });
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  return app;
}
