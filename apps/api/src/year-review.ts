import { Hono } from 'hono';
import { z } from 'zod';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { isReviewYear } from '@mesaaberta/core/profile/year-review';
import { readYearReview, shareYearReview } from '@mesaaberta/core/server/profile/year-review';
import { userGuard, viewerGuard, type UserVariables, type ViewerVariables } from './user-guard';

type Open = typeof createDb;
const shareBody = z.object({ shared: z.boolean() });

/**
 * Retrospectiva: a person's year at the tables, for them, or for anyone once they made it public,
 * and their "Deixar pública" switch. Web checks `use_year_review` before it calls these.
 */
export function yearReviewRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();
  const visitors = new Hono<{ Bindings: DatabaseEnv; Variables: ViewerVariables }>();
  visitors.use('*', viewerGuard(open));

  // A year with no Retrospectiva, an unknown person or a private one: all the same 404.
  visitors.get('/:username/:year', async (c) => {
    const year = Number(c.req.param('year'));
    if (!/^\d{4}$/.test(c.req.param('year')) || !isReviewYear(year, new Date()))
      return c.json({ error: 'not_found' }, 404);
    const found = await readYearReview(
      c.get('db'),
      c.req.param('username'),
      year,
      c.get('actor')?.id ?? null,
    );
    return found ? c.json(found) : c.json({ error: 'not_found' }, 404);
  });

  app.use('/share', userGuard(open));
  app.post('/share', async (c) => {
    const parsed = shareBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);
    return c.json(await shareYearReview(c.get('db'), c.get('actorId'), parsed.data.shared));
  });
  app.route('/', visitors);
  return app;
}
