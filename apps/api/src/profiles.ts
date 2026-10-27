import { Hono } from 'hono';
import {
  createDb,
  connectionStringFrom,
  type DatabaseEnv,
} from '@mesaaberta/core/server/db/client';
import { supabaseUrlOf } from '@mesaaberta/core/server/images';
import { publicProfile } from '@mesaaberta/core/server/profile/public';
import { ACTOR_HEADER } from './admin-guard';

type Env = DatabaseEnv & { SUPABASE_URL?: string };

/**
 * The public profile page's data (`GET /v1/profiles/:username?page=N`), for visitors and signed-in
 * people alike: the actor the web Worker names, when there is one, only decides the owner's view and
 * the follow part. Every flag-gated part is read; web asks the flags (targeted by `subject`, the
 * profile shown, and the viewer for follows) and drops what is off. An unknown or inactive person,
 * or a page past the last, is a 404: web then answers its own.
 */
export function profileRoutes(open: typeof createDb = createDb) {
  const app = new Hono<{ Bindings: Env }>();
  app.get('/:username', async (c) => {
    const page = c.req.query('page') ?? '1';
    if (!/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page)))
      return c.json({ error: 'not_found' }, 404);
    const connection = connectionStringFrom(c.env);
    if (!connection) return c.json({ error: 'unavailable' }, 503);
    const { db, close } = open(connection);
    try {
      const yes = async () => true;
      const profile = await publicProfile(db, c.req.param('username'), {
        page: Number(page),
        supabaseUrl: supabaseUrlOf(c.env),
        viewerId: c.req.header(ACTOR_HEADER) ?? null,
        showBadges: yes,
        showParticipantRating: yes,
        showFavoriteSystems: yes,
        showTableRole: true,
        withFollows: true,
      });
      if (!profile || profile.page > profile.pages) return c.json({ error: 'not_found' }, 404);
      return c.json(profile);
    } finally {
      await close().catch(() => undefined);
    }
  });
  return app;
}
