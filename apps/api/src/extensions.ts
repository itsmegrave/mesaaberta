import { Hono } from 'hono';
import { z } from 'zod';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { connectionStringFrom, createDb as openDb } from '@mesaaberta/core/server/db/client';
import { logger } from '@mesaaberta/core/server/logger';
import { socialFor, type SocialEnv } from '@mesaaberta/core/server/social/index';
import { SOCIAL_CAPTION_MAX } from '@mesaaberta/core/server/social/port';
import {
  extensionById,
  extensions,
  type Extension,
} from '@mesaaberta/core/server/extensions/index';
import { adminGuard, type AdminVariables } from './admin-guard';
import { afterAnswer, apiFlags, type FlagsEnv } from './flags';

type Open = typeof createDb;

const SOCIAL_POST = z.object({
  caption: z.string().trim().min(1).max(SOCIAL_CAPTION_MAX),
  mediaUrl: z
    .string()
    .trim()
    .max(2048)
    .url()
    .refine((url) => url.startsWith('https://')),
  confirmed: z.boolean().optional().default(false),
});

/**
 * The admin's hand actions on an installed extension (Trello #120): `POST /:ext/:action`, from that
 * extension's `adminActions`, behind `api_admin_<ext>` on the web side. Mounted at `/v1/admin`
 * after the routes with a path of their own. An action may render nothing and call no network: the
 * web Worker still starts any background work after its response, as before. Answers
 * `{ eventIds: [], ... }`, a 400 for data its schema refuses or a 404 for an extension or action
 * nobody installed.
 */
export function extensionRoutes(open: Open = openDb, installed: readonly Extension[] = extensions) {
  const app = new Hono<{
    Bindings: DatabaseEnv & Record<string, unknown>;
    Variables: AdminVariables;
  }>();

  app.use('*', adminGuard(open));

  // An extension's panel on the admin's connections page: its own data, never a token or a secret.
  app.get('/:ext/panel', async (c) => {
    const admin = extensionById(c.req.param('ext'), installed)?.admin;
    if (!admin) return c.json({ error: 'not_found' }, 404);
    return c.json({ panel: await admin.load(c.get('db'), c.env as never) });
  });

  // "Publicar no Instagram" after `queue` answered `queued`: the render and the publish run after
  // the answer, on a connection of their own. Failures are recorded on the durable job; never log
  // Meta payloads.
  app.post('/social/publish', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { tableId?: unknown } | null;
    const tableId = typeof body?.tableId === 'string' ? body.tableId : '';
    if (!/^[0-9a-f-]{36}$/i.test(tableId))
      return c.json({ error: 'invalid', field: 'tableId', message: 'invalid' }, 400);
    const env = c.env as SocialEnv & DatabaseEnv;
    const social = socialFor(env, installed);
    const connectionString = connectionStringFrom(env)!;
    afterAnswer(
      c,
      (async () => {
        const { db, close } = open(connectionString);
        try {
          const useTableImage = await apiFlags(c.env as FlagsEnv).isEnabled('use_table_image');
          await social.publishTable(db, env, tableId, new Date(), { useTableImage });
        } catch {
          logger.error('instagram.background_publish_failed', { tableId });
        } finally {
          await close().catch(() => undefined);
        }
      })(),
    );
    return c.json({ eventIds: [] }, 202);
  });

  // A hand-written post (an image or a video, by a public https address) on the deployment's
  // social account, for the MCP's post_on_social. Without `confirmed` it saves nothing and answers
  // what it would post; with it, it queues the post for the cron. The connector reads the media.
  app.post('/social/posts', async (c) => {
    const parsed = SOCIAL_POST.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? '');
      return c.json({ error: 'invalid', field, message: 'invalid' }, 400);
    }
    const social = socialFor(c.env as SocialEnv, installed);
    if (!social.queuePost || !social.configured(c.env))
      return c.json({ error: 'unavailable' }, 503);
    const { caption, mediaUrl, confirmed } = parsed.data;
    const answer = await social.queuePost(
      c.get('db'),
      c.env,
      { caption, media: { url: mediaUrl }, createdBy: c.get('actorId') },
      { confirmed },
    );
    if ('invalid' in answer)
      return c.json(
        { error: 'invalid', field: answer.invalid.field, message: answer.invalid.code },
        400,
      );
    if ('status' in answer && answer.status === 'unavailable')
      return c.json({ error: 'unavailable' }, 503);
    return c.json({ eventIds: [], network: social.label ?? social.name, ...answer });
  });

  // Where a hand-written post stands (queued, published with its link, failed).
  app.get('/social/posts/:id', async (c) => {
    const id = c.req.param('id');
    const social = socialFor(c.env as SocialEnv, installed);
    if (!/^[0-9a-f-]{36}$/i.test(id) || !social.postStatus)
      return c.json({ error: 'not_found' }, 404);
    const post = await social.postStatus(c.get('db'), c.env, id);
    return post ? c.json({ post }) : c.json({ error: 'not_found' }, 404);
  });

  app.post('/:ext/:action', async (c) => {
    const actions = extensionById(c.req.param('ext'), installed)?.adminActions;
    const name = c.req.param('action');
    if (!actions || !Object.hasOwn(actions, name)) return c.json({ error: 'not_found' }, 404);
    const action = actions[name];

    const parsed = action.schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);

    const result = await action.apply(c.get('db'), c.env as never, parsed.data as never);
    return c.json({ eventIds: [], ...result });
  });

  return app;
}
