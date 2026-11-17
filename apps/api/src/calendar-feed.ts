import { Hono } from 'hono';
import {
  connectionStringFrom,
  createDb,
  type DatabaseEnv,
} from '@mesaaberta/core/server/db/client';
import {
  FEED_PAST_DAYS,
  calendarFeedOwner,
  listCalendarTables,
} from '@mesaaberta/core/server/calendar/feed';

const DAY_MS = 86_400_000;

/**
 * `GET /:token`: the tables in the calendar feed a secret opens, for web to write as `.ics`, with
 * whose feed it is (web checks `use_calendar_feed` for that person). No actor: a calendar app reads
 * the feed without signing in, and the secret is the only key. An unknown secret is a 404.
 */
export function calendarFeedRoutes(open: typeof createDb = createDb) {
  const app = new Hono<{ Bindings: DatabaseEnv }>();
  app.get('/:token', async (c) => {
    const connection = connectionStringFrom(c.env);
    if (!connection) return c.json({ error: 'unavailable' }, 503);
    const { db, close } = open(connection);
    try {
      const profileId = await calendarFeedOwner(db, c.req.param('token'));
      if (!profileId) return c.json({ error: 'not_found' }, 404);
      const now = new Date();
      const since = new Date(now.getTime() - FEED_PAST_DAYS * DAY_MS);
      return c.json({ profileId, tables: await listCalendarTables(db, profileId, now, since) });
    } finally {
      await close().catch(() => undefined);
    }
  });
  return app;
}
