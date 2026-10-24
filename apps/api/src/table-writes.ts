import { Hono, type Context } from 'hono';
import type { ZodType } from 'zod';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { loadTableForDuplication } from '@mesaaberta/core/server/tables/duplicate';
import { tableWriteActions } from '@mesaaberta/core/server/tables/write-actions';
import { refusal } from './refusal';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

type Action = {
  schema: ZodType;
  apply: (
    db: unknown,
    actor: unknown,
    slug: string,
    data: unknown,
  ) => Promise<{ eventIds: string[]; slug: string; draft?: boolean }>;
};

/**
 * The GM's table record writes of Trello #120: create (`POST /`), and edit and disable
 * (`POST /:slug/update`, `/:slug/disable`). The web Worker has validated the form, stored the image
 * and resolved the postal code; this takes the result and runs the same services, from core's
 * `tableWriteActions`. Answers `{ eventIds, slug, draft? }`, or the refusal the service made.
 */
export function tableWriteRoutes(open: Open = openDb, duplicationOnly = false) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();

  if (duplicationOnly) {
    app.use('/:slug/duplicate', userGuard(open));
    app.use('/:slug/duplication', userGuard(open));
  } else app.use('*', userGuard(open));

  const run = async (
    c: Context<{ Bindings: DatabaseEnv; Variables: UserVariables }>,
    name: string,
    slug: string,
  ) => {
    const action = tableWriteActions[name as keyof typeof tableWriteActions] as unknown as Action;
    const parsed = action.schema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);
    try {
      return c.json(await action.apply(c.get('db'), c.get('actor'), slug, parsed.data));
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  };

  if (duplicationOnly) {
    app.get('/:slug/duplication', async (c) => {
      try {
        return c.json(
          await loadTableForDuplication(c.get('db'), c.get('actor'), c.req.param('slug')),
        );
      } catch (cause) {
        const refused = refusal(c, cause);
        if (refused) return refused;
        throw cause;
      }
    });
    app.post('/:slug/duplicate', (c) => run(c, 'duplicate', c.req.param('slug')));
    return app;
  }
  app.post('/', (c) => run(c, 'create', ''));
  app.post('/:slug/:action', (c) => {
    const name = c.req.param('action');
    // `duplicate` is served only by its own `/v1/tables` mount, never by this legacy one.
    if (name === 'create' || name === 'duplicate' || !Object.hasOwn(tableWriteActions, name))
      return c.json({ error: 'not_found' }, 404);
    return run(c, name, c.req.param('slug'));
  });

  return app;
}
