import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { profiles } from '@mesaaberta/db/schema';
import { NOTIFICATION_CATEGORIES } from '@mesaaberta/core/notifications/kinds';
import { pageNumber } from '@mesaaberta/core/admin/catalog';
import { pendingCount } from '@mesaaberta/core/server/admin/catalog';
import { can } from '@mesaaberta/core/server/auth/policy';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb, connectionStringFrom } from '@mesaaberta/core/server/db/client';
import { unreadConversations } from '@mesaaberta/core/server/messages/service';
import {
  BELL_LIMIT,
  listNotifications,
  notificationPage,
  unreadCount,
} from '@mesaaberta/core/server/notifications/service';
import { ACTOR_HEADER } from './admin-guard';
import { refusal } from './refusal';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

/**
 * The signed-in person's own frame (Trello #120): their profile row, which the web Worker uses as
 * the actor of every request, the header's numbers and the bell, and the notification feed. The
 * subject is always the actor the web Worker names. `achievements=1` says the badge notices are on
 * for them (`use_badges`, decided in web).
 */
export function meRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();

  // The whole profile row, or null for an account that has no profile yet (not a refusal: the web
  // Worker then sends the person to finish it).
  app.get('/', async (c) => {
    const actorId = c.req.header(ACTOR_HEADER);
    const connectionString = connectionStringFrom(c.env);
    if (!actorId) return c.json({ error: 'unauthorized' }, 401);
    if (!connectionString) return c.json({ error: 'unavailable' }, 503);
    const { db, close } = open(connectionString);
    try {
      const [row] = await db.select().from(profiles).where(eq(profiles.id, actorId));
      return c.json({ profile: row ?? null });
    } finally {
      await close().catch(() => undefined);
    }
  });

  app.use('/*', userGuard(open));

  const withAchievements = (value: string | undefined) => value === '1';

  // The header on every page: the bell's number and latest few, the conversations with something
  // unread, and for an admin the catalog suggestions waiting.
  app.get('/shell', async (c) => {
    const db = c.get('db');
    const actor = c.get('actor');
    const options = { withAchievements: withAchievements(c.req.query('achievements')) };
    const [unread, latest, messagesUnread, pendingSuggestions] = await Promise.all([
      unreadCount(db, actor.id, options),
      listNotifications(db, actor.id, { limit: BELL_LIMIT, ...options }),
      unreadConversations(db, actor.id),
      can(actor, 'admin:access') ? pendingCount(db) : 0,
    ]);
    return c.json({ unread, latest, messagesUnread, pendingSuggestions });
  });

  // The two numbers the page polls.
  app.get('/badges', async (c) => {
    const db = c.get('db');
    const actorId = c.get('actorId');
    const [unread, messages] = await Promise.all([
      unreadCount(db, actorId, {
        withAchievements: withAchievements(c.req.query('achievements')),
      }),
      unreadConversations(db, actorId),
    ]);
    return c.json({ unread, messages });
  });

  // A page of the feed (`?page=N`, `category`, `unread=1`) and the unread total over all of it. A
  // page past the last is a 404.
  app.get('/notifications', async (c) => {
    const db = c.get('db');
    const actorId = c.get('actorId');
    const options = { withAchievements: withAchievements(c.req.query('achievements')) };
    const category = NOTIFICATION_CATEGORIES.find((value) => value === c.req.query('category'));
    try {
      const [feed, unreadTotal] = await Promise.all([
        notificationPage(db, actorId, pageNumber(c.req.query('page') ?? null), {
          category,
          unread: c.req.query('unread') === '1',
          ...options,
        }),
        unreadCount(db, actorId, options),
      ]);
      return c.json({ ...feed, unreadTotal });
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  return app;
}
