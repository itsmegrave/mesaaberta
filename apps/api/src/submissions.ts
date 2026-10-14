import { Hono, type Context } from 'hono';
import type { ZodType } from 'zod';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { submissionActions } from '@mesaaberta/core/server/submissions/actions';
import { refusal } from './refusal';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;
type Ctx = Context<{ Bindings: DatabaseEnv; Variables: UserVariables }>;

type Action = {
  schema: ZodType;
  apply: (
    db: unknown,
    actor: unknown,
    id: string,
    data: unknown,
  ) => Promise<Record<string, unknown>>;
};

/**
 * What a member submits (Trello #120): `POST /partners`, `POST /partners/:id` (an edit) and
 * `POST /crowdfundings`. The web Worker has validated the form and stored the picture; this takes
 * the input and the stored path and runs the same services, from core's `submissionActions`.
 * Answers `{ eventIds, ... }`, or the refusal the service made.
 */
export function submissionRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();

  app.use('*', userGuard(open));

  const run = async (c: Ctx, name: keyof typeof submissionActions, id: string) => {
    const action = submissionActions[name] as unknown as Action;
    const parsed = action.schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);
    try {
      return c.json(await action.apply(c.get('db'), c.get('actor'), id, parsed.data));
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  };

  app.post('/partners', (c) => run(c, 'partnerAdd', ''));
  app.post('/partners/:id', (c) => run(c, 'partnerUpdate', c.req.param('id')));
  app.post('/crowdfundings', (c) => run(c, 'crowdfundingAdd', ''));

  return app;
}
