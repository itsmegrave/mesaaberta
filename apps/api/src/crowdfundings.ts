import { Hono } from 'hono';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { readCrowdfundingFilters } from '@mesaaberta/core/crowdfunding/filters';
import {
  findListedByUrl,
  listCrowdfundings,
  takeLinkRead,
} from '@mesaaberta/core/server/crowdfunding/service';
import { refusal } from './refusal';
import { userGuard, viewerGuard, type UserVariables, type ViewerVariables } from './user-guard';

type Open = typeof createDb;

/**
 * Financiamentos (Trello #120): the list, and the two checks the add form makes before it fetches
 * or stores anything. Adding itself is `POST /v1/submissions/crowdfundings`.
 */
export function crowdfundingRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();
  const visitors = new Hono<{ Bindings: DatabaseEnv; Variables: ViewerVariables }>();

  visitors.use('*', viewerGuard(open));

  // One page of the list for the address's filters, each campaign with its `submitterId` (web turns
  // it into `canReport` and never sends it to the browser). A page past the last is a 404.
  visitors.get('/', async (c) => {
    const list = await listCrowdfundings(
      c.get('db'),
      readCrowdfundingFilters(new URL(c.req.url).searchParams),
    );
    return list ? c.json(list) : c.json({ error: 'not_found' }, 404);
  });

  app.route('/', visitors);
  app.use('*', userGuard(open));
  app.onError((error, c) => {
    const refused = refusal(c, error);
    if (refused) return refused;
    throw error;
  });

  // Whether a campaign at this link is listed already.
  app.get('/listed', async (c) =>
    c.json({ listed: (await findListedByUrl(c.get('db'), c.req.query('url') ?? '')) !== null }),
  );

  // Counts one read of a campaign page against the actor's LINK_READ_LIMIT (`rate_limited` past it).
  app.post('/link-read', async (c) => {
    await takeLinkRead(c.get('db'), c.get('actorId'));
    return c.json({ eventIds: [] });
  });

  return app;
}
