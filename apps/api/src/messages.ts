import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { gameTables, profiles } from '@mesaaberta/db/schema';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { messageReportSchema } from '@mesaaberta/core/moderation/reports';
import { listBlocked, setBlocked } from '@mesaaberta/core/server/blocks/service';
import { fileMessageReport } from '@mesaaberta/core/server/moderation/reports';
import { openTableChat, openThread } from '@mesaaberta/core/server/messages/reads';
import {
  listInbox,
  listMessages,
  markConversationRead,
  openDirect,
} from '@mesaaberta/core/server/messages/service';
import { refusal } from './refusal';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

const conversationId = z.guid();
const blockSchema = z.object({ profileId: z.guid(), blocked: z.boolean() });

/**
 * Mensagens (Trello #120): the inbox, a thread and its older pages, the read mark, a table's chat,
 * and blocking and reporting from a conversation. The subject is always the actor; the services
 * authorize membership. `use_message_safety` is checked by the web Worker before it calls block or
 * report. Pictures are drawn by the web Worker, which knows the storage address.
 */
export function messageRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();

  app.use('*', userGuard(open));

  // A page that is not a positive whole number reads as the first; one past the last is a 404.
  app.get('/inbox', async (c) => {
    const raw = c.req.query('page');
    const page = raw && /^[1-9][0-9]*$/.test(raw) ? Number(raw) : 1;
    const kind = c.req.query('kind');
    return c.json(
      await listInbox(
        c.get('db'),
        c.get('actorId'),
        page,
        kind === 'direct' || kind === 'table' ? kind : undefined,
      ),
    );
  });

  // "Pessoas bloqueadas" on the profile form.
  app.get('/blocked', async (c) => c.json(await listBlocked(c.get('db'), c.get('actor'))));

  app.post('/block', async (c) => {
    const parsed = blockSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);
    const { profileId, blocked } = parsed.data;
    return c.json(await setBlocked(c.get('db'), c.get('actor'), profileId, blocked));
  });

  // A table's chat for its GM and confirmed players, made on first use.
  app.post('/tables/:slug', async (c) =>
    c.json(await openTableChat(c.get('db'), c.get('actor'), c.req.param('slug'))),
  );

  // "Falar com quem mestra": the direct conversation with an active table's GM, made when there
  // is none (`directBlocker` decides who may start one).
  app.post('/tables/:slug/gm', async (c) => {
    const [table] = await c
      .get('db')
      .select({ gmId: gameTables.gmId, slug: gameTables.slug })
      .from(gameTables)
      .where(and(eq(gameTables.slug, c.req.param('slug')), eq(gameTables.status, 'active')));
    if (!table) return c.json({ error: 'not_found' }, 404);
    const conversation = await openDirect(c.get('db'), c.get('actor'), table.gmId);
    return c.json({ eventIds: [], conversationId: conversation.id, slug: table.slug });
  });

  // "Mandar mensagem" on a profile: the direct conversation with that person, made when there is
  // none. The username is matched as typed in the URL, already normalized by web.
  app.post('/users/:username', async (c) => {
    const [target] = await c
      .get('db')
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.username, c.req.param('username')));
    if (!target) return c.json({ error: 'not_found' }, 404);
    const conversation = await openDirect(c.get('db'), c.get('actor'), target.id);
    return c.json({ eventIds: [], conversationId: conversation.id });
  });

  // Anything that is not a conversation id is no conversation.
  app.use('/:id/*', async (c, next) => {
    if (!conversationId.safeParse(c.req.param('id')).success)
      return c.json({ error: 'not_found' }, 404);
    await next();
  });
  app.use('/:id', async (c, next) => {
    if (!conversationId.safeParse(c.req.param('id')).success)
      return c.json({ error: 'not_found' }, 404);
    await next();
  });

  // The newest messages, for the open thread to poll, or the ones before `before` (an ISO time).
  app.get('/:id', async (c) => {
    const raw = c.req.query('before');
    const before = raw ? new Date(raw) : undefined;
    if (before && Number.isNaN(before.getTime()))
      return c.json({ error: 'invalid', field: 'before', message: 'invalid' }, 400);
    return c.json(await listMessages(c.get('db'), c.get('actor'), c.req.param('id'), { before }));
  });

  // Opening the thread reads it: everything up to now is seen.
  app.post('/:id/open', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { about?: unknown };
    const about = typeof body.about === 'string' && body.about ? body.about : null;
    return c.json(await openThread(c.get('db'), c.get('actor'), c.req.param('id'), about));
  });

  app.post('/:id/read', async (c) => {
    await markConversationRead(c.get('db'), c.get('actor'), c.req.param('id'));
    return c.json({ eventIds: [] });
  });

  // "Denunciar mensagem" and "Denunciar @x". Admins see it in the queue.
  app.post('/:id/report', async (c) => {
    const parsed = messageReportSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return c.json(
        {
          error: 'invalid',
          field: String(issue?.path[0] ?? ''),
          message: issue?.message ?? 'invalid',
        },
        400,
      );
    }
    const { eventId } = await fileMessageReport(
      c.get('db'),
      c.get('actor'),
      c.req.param('id'),
      parsed.data,
    );
    return c.json({ eventIds: [eventId] });
  });

  app.onError((error, c) => {
    const refused = refusal(c, error);
    if (refused) return refused;
    throw error;
  });

  return app;
}
