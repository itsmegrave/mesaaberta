import { Hono } from 'hono';
import { z } from 'zod';
import {
  connectionStringFrom,
  createDb,
  type DatabaseEnv,
} from '@mesaaberta/core/server/db/client';
import { announceChangelogDay } from '@mesaaberta/core/server/notifications/changelog';
import { apiFlags, type FlagsEnv } from './flags';

type Open = typeof createDb;

const day = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(200),
  summary: z.string().max(2000),
  link: z.string().startsWith('/').max(200),
});

/**
 * `POST /notice` with the newest changelog day (the web Worker ships the changelog and its
 * translations, so it sends the day as shown). While `use_changelog_notices` is on, the day goes to
 * everyone's bell once (`announceChangelogDay`); the background Worker's sweep delivers it, as
 * before. No actor: it is the release speaking, and the Service Binding is the only way in.
 */
export function changelogRoutes(open: Open = createDb) {
  const app = new Hono<{ Bindings: DatabaseEnv & FlagsEnv }>();

  app.post('/notice', async (c) => {
    const parsed = day.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);
    if (!(await apiFlags(c.env).isEnabled('use_changelog_notices')))
      return c.json({ announced: false });
    const connectionString = connectionStringFrom(c.env);
    if (!connectionString) return c.json({ error: 'unavailable' }, 503);
    const { db, close } = open(connectionString);
    try {
      return c.json({ announced: (await announceChangelogDay(db, parsed.data)) !== null });
    } finally {
      await close().catch(() => undefined);
    }
  });

  return app;
}
