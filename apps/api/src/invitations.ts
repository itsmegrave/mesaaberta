import { Hono } from 'hono';
import { z } from 'zod';
import {
  createDb as openDb,
  type createDb,
  type DatabaseEnv,
} from '@mesaaberta/core/server/db/client';
import {
  invitePlayer,
  invitationPreferences,
  listReceivedInvitations,
  listTableInvitations,
  loadInvitation,
  pendingInvitationFor,
  inviteUsername,
  respondToInvitation,
  cancelInvitation,
  setInvitationsEnabled,
  setGmInviteBlock,
} from '@mesaaberta/core/server/invitations/service';
import { userGuard, type UserVariables } from './user-guard';
import { refusal } from './refusal';
import { eq } from 'drizzle-orm';
import { gameTables } from '@mesaaberta/db/schema';
const target = z.union([
  z.object({ playerId: z.uuid() }),
  z.object({ username: z.string().trim().min(1).max(64) }),
]);
export function invitationRoutes(open: typeof createDb = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();
  app.use('/tables/:slug/invitations', userGuard(open));
  app.use('/invitations/*', userGuard(open));
  app.use('/account/invitations', userGuard(open));
  app.use('/account/invitation-blocks', userGuard(open));
  app.use('/account/invitation-preferences', userGuard(open));
  app.use('/tables/:slug/my-invitation', userGuard(open));
  app.get('/account/invitation-preferences', async (c) =>
    c.json(await invitationPreferences(c.get('db'), c.get('actor'))),
  );
  app.get('/account/invitations', async (c) =>
    c.json(await listReceivedInvitations(c.get('db'), c.get('actor'))),
  );
  app.get('/invitations/:id', async (c) => {
    if (!z.uuid().safeParse(c.req.param('id')).success) return c.json({ error: 'not_found' }, 404);
    try {
      return c.json(await loadInvitation(c.get('db'), c.get('actor'), c.req.param('id')));
    } catch (cause) {
      const refused = refusal(c, cause);
      if (refused) return refused;
      throw cause;
    }
  });
  app.get('/tables/:slug/invitations', async (c) => {
    try {
      return c.json(await listTableInvitations(c.get('db'), c.get('actor'), c.req.param('slug')));
    } catch (cause) {
      const refused = refusal(c, cause);
      if (refused) return refused;
      throw cause;
    }
  });
  app.get('/tables/:slug/my-invitation', async (c) => {
    const [table] = await c
      .get('db')
      .select({ id: gameTables.id })
      .from(gameTables)
      .where(eq(gameTables.slug, c.req.param('slug')));
    return c.json(
      table ? await pendingInvitationFor(c.get('db'), table.id, c.get('actor').id) : null,
    );
  });
  app.post('/tables/:slug/invitations', async (c) => {
    const input = target.safeParse(await c.req.json().catch(() => null));
    if (!input.success)
      return c.json({ error: 'invalid', field: 'username', message: 'invalid' }, 400);
    try {
      return c.json(
        await ('playerId' in input.data
          ? invitePlayer(c.get('db'), c.get('actor'), c.req.param('slug'), input.data.playerId)
          : inviteUsername(c.get('db'), c.get('actor'), c.req.param('slug'), input.data.username)),
      );
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });
  app.post('/invitations/:id/:decision', async (c) => {
    const id = z.uuid().safeParse(c.req.param('id'));
    const decision = c.req.param('decision');
    if (!id.success || !['accept', 'decline', 'cancel'].includes(decision))
      return c.json({ error: 'not_found' }, 404);
    try {
      return c.json(
        await (decision === 'cancel'
          ? cancelInvitation(c.get('db'), c.get('actor'), id.data)
          : respondToInvitation(
              c.get('db'),
              c.get('actor'),
              id.data,
              decision as 'accept' | 'decline',
            )),
      );
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });
  app.post('/account/invitation-preferences', async (c) => {
    const input = z
      .object({ enabled: z.boolean() })
      .safeParse(await c.req.json().catch(() => null));
    if (!input.success)
      return c.json({ error: 'invalid', field: 'enabled', message: 'invalid' }, 400);
    try {
      return c.json(await setInvitationsEnabled(c.get('db'), c.get('actor'), input.data.enabled));
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });
  app.post('/account/invitation-blocks', async (c) => {
    const input = z
      .object({ gmId: z.uuid(), blocked: z.boolean() })
      .safeParse(await c.req.json().catch(() => null));
    if (!input.success) return c.json({ error: 'invalid', field: 'gmId', message: 'invalid' }, 400);
    try {
      return c.json(
        await setGmInviteBlock(c.get('db'), c.get('actor'), input.data.gmId, input.data.blocked),
      );
    } catch (error) {
      const refused = refusal(c, error);
      if (refused) return refused;
      throw error;
    }
  });
  return app;
}
