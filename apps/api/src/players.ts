import { Hono } from 'hono';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { lookingSchema, readPlayerFilters } from '@mesaaberta/core/players/looking';
import {
  listLookingPlayers,
  lookingOf,
  setLooking,
} from '@mesaaberta/core/server/players/directory';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

/**
 * Procuro mesa (`/players`): the people looking for a table and the actor's own "Estou procurando
 * mesa". Signed-in people only; web checks `use_players_directory` before it calls these.
 */
export function playerRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();
  app.use('*', userGuard(open));

  // One page of the list (a page past the last is a 404) and the actor's own state.
  app.get('/', async (c) => {
    const now = new Date();
    const [list, me] = await Promise.all([
      listLookingPlayers(c.get('db'), readPlayerFilters(new URL(c.req.url).searchParams), now),
      lookingOf(c.get('db'), c.get('actorId'), now),
    ]);
    return list ? c.json({ ...list, me }) : c.json({ error: 'not_found' }, 404);
  });

  app.post('/looking', async (c) => {
    const parsed = lookingSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return c.json(
        { error: 'invalid', field: String(issue?.path[0] ?? ''), message: issue?.message },
        400,
      );
    }
    return c.json(await setLooking(c.get('db'), c.get('actorId'), parsed.data, new Date()));
  });

  return app;
}
