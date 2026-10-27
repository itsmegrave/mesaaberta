import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { profiles } from '@mesaaberta/db/schema';
import { NOTIFICATION_CATEGORIES } from '@mesaaberta/core/notifications/kinds';
import { pageNumber } from '@mesaaberta/core/admin/catalog';
import { pendingCount } from '@mesaaberta/core/server/admin/catalog';
import { can } from '@mesaaberta/core/server/auth/policy';
import {
  CROWDFUNDING_LIMIT,
  PLACE_CLAIM_LIMIT,
  PLACE_LIMIT,
  TABLE_CREATION_LIMIT,
  TABLE_DRAFT_LIMIT,
  checkRateLimit,
} from '@mesaaberta/core/server/rate-limit';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb, connectionStringFrom } from '@mesaaberta/core/server/db/client';
import { unreadConversations } from '@mesaaberta/core/server/messages/service';
import { isUsernameAvailable, loadProfileForm } from '@mesaaberta/core/server/profile/service';
import { exportAccount } from '@mesaaberta/core/server/account/service';
import { setBadgeHidden } from '@mesaaberta/core/server/badges/reads';
import { listCalendarTables } from '@mesaaberta/core/server/calendar/feed';
import { hasPassword } from '@mesaaberta/core/server/auth/has-password';
import { stillBanned } from '@mesaaberta/core/server/moderation/bans';
import { favoriteSystemsSchema } from '@mesaaberta/core/profile/favorite-systems';
import {
  readFavoriteSystems,
  setFavoriteSystems,
} from '@mesaaberta/core/server/profile/favorite-systems';
import { listSystems } from '@mesaaberta/core/server/systems';
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

/** The limits a form tells a person about before it stores anything; the write checks again. */
const LIMITS = {
  table: TABLE_CREATION_LIMIT,
  draft: TABLE_DRAFT_LIMIT,
  crowdfunding: CROWDFUNDING_LIMIT,
  place: PLACE_LIMIT,
  placeClaim: PLACE_CLAIM_LIMIT,
};

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

  // A suspended account, on its next request: still barred, or a temporary ban whose time is up,
  // which is lifted here (`eventIds` holds that event to dispatch).
  app.post('/ban-check', async (c) => {
    const db = c.get('db');
    const [row] = await db
      .select({ id: profiles.id, status: profiles.status, bannedUntil: profiles.bannedUntil })
      .from(profiles)
      .where(eq(profiles.id, c.get('actorId')));
    return c.json(await stillBanned(db, row));
  });

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

  // The actor's profile as its form shows it (the onboarding step and "Editar perfil").
  app.get('/profile-form', async (c) =>
    c.json(await loadProfileForm(c.get('db'), c.get('actorId'))),
  );

  // Whether a username is free for the actor (their own counts as free).
  app.get('/username-available', async (c) => {
    const username = c.req.query('username') ?? '';
    if (!username) return c.json({ available: false });
    return c.json({
      available: await isUsernameAvailable(c.get('db'), username, {
        exceptProfileId: c.get('actorId'),
      }),
    });
  });

  // Whether the e-mail and password way in is on (a password set on a provider account).
  app.get('/has-password', async (c) =>
    c.json({ hasPassword: await hasPassword(c.get('db'), c.get('actorId')) }),
  );

  // The data portability copy (LGPD art. 18, V). `email` is the account's own, which web reads
  // from Auth.
  app.get('/export', async (c) =>
    c.json(await exportAccount(c.get('db'), c.get('actorId'), c.req.query('email') ?? '')),
  );

  // "Baixar calendário": the tables the actor runs or has a seat at, for web to write as `.ics`.
  app.get('/calendar', async (c) =>
    c.json(await listCalendarTables(c.get('db'), c.get('actorId'), new Date())),
  );

  // The eye on an earned badge: hides it from the actor's profile, or shows it again. 404 when
  // the actor has no such badge.
  app.post('/badges/:badgeId/hidden', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { hidden?: unknown } | null;
    if (typeof body?.hidden !== 'boolean') return c.json({ error: 'invalid' }, 400);
    const changed = await setBadgeHidden(
      c.get('db'),
      c.get('actorId'),
      c.req.param('badgeId'),
      body.hidden,
    );
    return changed ? c.json({ eventIds: [] }) : c.json({ error: 'not_found' }, 404);
  });

  // "Sistemas favoritos": every system, and the ones the actor follows.
  app.get('/favorite-systems', async (c) => {
    const [systems, favorites] = await Promise.all([
      listSystems(c.get('db')),
      readFavoriteSystems(c.get('db'), c.get('actorId')),
    ]);
    return c.json({ systems, favorites });
  });

  app.post('/favorite-systems', async (c) => {
    const parsed = favoriteSystemsSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return c.json(
        { error: 'invalid', field: 'systems', message: issue?.message ?? 'invalid' },
        400,
      );
    }
    try {
      return c.json(await setFavoriteSystems(c.get('db'), c.get('actorId'), parsed.data));
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  // Whether the actor is under a limit now: `{ ok: true }`, or the refusal with when it frees.
  app.get('/limits/:name', async (c) => {
    const name = c.req.param('name');
    if (!Object.hasOwn(LIMITS, name)) return c.json({ error: 'not_found' }, 404);
    try {
      await checkRateLimit(c.get('db'), c.get('actorId'), LIMITS[name as keyof typeof LIMITS]);
      return c.json({ ok: true });
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
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
