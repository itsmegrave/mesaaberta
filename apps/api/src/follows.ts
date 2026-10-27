import { and, eq, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { gameTables } from '@mesaaberta/db/schema';
import { can } from '@mesaaberta/core/server/auth/policy';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { pageNumber } from '@mesaaberta/core/admin/catalog';
import { followNoticesSchema } from '@mesaaberta/core/follows/schema';
import {
  follow,
  followerCount,
  isFollowing,
  listFollowing,
  setFollowNotices,
  unfollow,
} from '@mesaaberta/core/server/follows/service';
import { supabaseUrlOf } from '@mesaaberta/core/server/images';
import { refusal } from './refusal';
import { userGuard, viewerGuard, type UserVariables, type ViewerVariables } from './user-guard';

type Open = typeof createDb;
type Env = DatabaseEnv & { SUPABASE_URL?: string };

const profileId = z.guid();
const followBody = z.object({ follow: z.boolean() });

/**
 * Seguir (Trello #120): whether the actor follows someone, following and unfollowing, "Seguindo"
 * and its bell switches. The subject is always the actor; `use_follows` is checked by the web
 * Worker before it calls these.
 */
export function followRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: Env; Variables: UserVariables }>();
  const visitors = new Hono<{ Bindings: Env; Variables: ViewerVariables }>();

  visitors.use('*', viewerGuard(open));

  // The Seguir button on a table's GM row, visitors too: whom it follows and whether the actor
  // already does. A table the viewer cannot see (disabled, someone else's draft) is a 404.
  visitors.get('/gm/:slug', async (c) => {
    const actor = c.get('actor');
    const [table] = await c
      .get('db')
      .select({ gmId: gameTables.gmId, status: gameTables.status })
      .from(gameTables)
      .where(and(eq(gameTables.slug, c.req.param('slug')), ne(gameTables.status, 'disabled')));
    const visible =
      table &&
      (table.status !== 'draft' ||
        (actor !== null && (actor.id === table.gmId || can(actor, 'admin:access'))));
    if (!visible) return c.json({ error: 'not_found' }, 404);
    return c.json({
      profileId: table.gmId,
      following: actor ? await isFollowing(c.get('db'), actor.id, table.gmId) : false,
    });
  });

  app.route('/', visitors);
  app.use('*', userGuard(open));

  // "Seguindo": a page of the people the actor follows (a page past the last is a 404) and how
  // many follow them.
  app.get('/', async (c) => {
    const page = pageNumber(c.req.query('page') ?? null);
    const [following, followers] = await Promise.all([
      listFollowing(c.get('db'), c.get('actorId'), { page, supabaseUrl: supabaseUrlOf(c.env) }),
      followerCount(c.get('db'), c.get('actorId')),
    ]);
    if (page > following.pages) return c.json({ error: 'not_found' }, 404);
    return c.json({ following, followers });
  });

  app.post('/notices', async (c) => {
    const parsed = followNoticesSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);
    await setFollowNotices(c.get('db'), c.get('actorId'), parsed.data);
    return c.json({ eventIds: [] });
  });

  app.get('/:profileId', async (c) => {
    const id = c.req.param('profileId');
    if (!profileId.safeParse(id).success) return c.json({ error: 'not_found' }, 404);
    return c.json({ following: await isFollowing(c.get('db'), c.get('actorId'), id) });
  });

  // Follow (`{ follow: true }`, records `FollowStarted` the first time) or stop following.
  app.post('/:profileId', async (c) => {
    const id = c.req.param('profileId');
    if (!profileId.safeParse(id).success) return c.json({ error: 'not_found' }, 404);
    const parsed = followBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);
    if (!parsed.data.follow) {
      await unfollow(c.get('db'), c.get('actorId'), id);
      return c.json({ eventIds: [] });
    }
    try {
      return c.json(await follow(c.get('db'), c.get('actor'), id));
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });

  return app;
}
