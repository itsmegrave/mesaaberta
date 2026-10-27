import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { readPartnerFilters } from '@mesaaberta/core/partners/filters';
import {
  partnerInvitationIdSchema,
  partnerInviteSchema,
  partnerOwnerSchema,
} from '@mesaaberta/core/partners/owners';
import { findOwnPartner, listPartners } from '@mesaaberta/core/server/partners/service';
import {
  cancelPartnerInvitation,
  invitePartnerOwner,
  listPartnerOwners,
  loadPartnerInvitation,
  removePartnerOwner,
  respondToPartnerInvitation,
} from '@mesaaberta/core/server/partners/owners';
import { refusal } from './refusal';
import { userGuard, viewerGuard, type UserVariables, type ViewerVariables } from './user-guard';

type Open = typeof createDb;

const id = z.guid();

/**
 * Parceiros (Trello #120): the list, a partner's edit form and "Quem cuida do parceiro" with its
 * invites. The services authorize; `use_partner_owners` is checked by the web Worker before it
 * calls the owner routes it gates (answering an invite is never gated).
 */
export function partnerRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();
  const visitors = new Hono<{ Bindings: DatabaseEnv; Variables: ViewerVariables }>();

  visitors.use('*', viewerGuard(open));

  // One page of the list for the address's filters, with each card's owners (web turns them into
  // `canEdit` and `canReport`). A page past the last is a 404.
  visitors.get('/', async (c) => {
    const list = await listPartners(
      c.get('db'),
      readPartnerFilters(new URL(c.req.url).searchParams),
      {
        viewerId: c.get('actor')?.id ?? null,
      },
    );
    return list ? c.json(list) : c.json({ error: 'not_found' }, 404);
  });

  app.route('/', visitors);
  app.use('*', userGuard(open));
  app.onError((error, c) => {
    const refused = refusal(c, error);
    if (refused) return refused;
    throw error;
  });

  // The invite to look after a partner, for the person invited only.
  app.get('/invitations/:id', async (c) => {
    if (!id.safeParse(c.req.param('id')).success) return c.json({ error: 'not_found' }, 404);
    return c.json(await loadPartnerInvitation(c.get('db'), c.get('actor'), c.req.param('id')));
  });

  app.post('/invitations/:id/:decision{accept|decline}', async (c) => {
    if (!id.safeParse(c.req.param('id')).success) return c.json({ error: 'not_found' }, 404);
    const decision = c.req.param('decision') as 'accept' | 'decline';
    return c.json(
      await respondToPartnerInvitation(c.get('db'), c.get('actor'), c.req.param('id'), decision),
    );
  });

  app.use('/:id/*', async (c, next) => {
    if (!id.safeParse(c.req.param('id')).success) return c.json({ error: 'not_found' }, 404);
    await next();
  });

  // The edit form of a partner the actor looks after (404/403 otherwise), and its owners with
  // `owners=1` (web asks while `use_partner_owners` is on for the actor).
  app.get('/:id/edit', async (c) => {
    const partner = await findOwnPartner(c.get('db'), c.get('actor'), c.req.param('id'));
    const owners =
      c.req.query('owners') === '1'
        ? await listPartnerOwners(c.get('db'), c.get('actor'), partner.id)
        : null;
    return c.json({ partner, owners });
  });

  const body = async <S extends z.ZodType>(c: Context, schema: S) => {
    const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
    return parsed.success ? parsed.data : null;
  };
  const invalid = (c: Context) => c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);

  app.post('/:id/owners/invite', async (c) => {
    const data = await body(c, partnerInviteSchema);
    if (!data) return invalid(c);
    return c.json(
      await invitePartnerOwner(c.get('db'), c.get('actor'), c.req.param('id'), data.username),
    );
  });

  app.post('/:id/owners/cancel', async (c) => {
    const data = await body(c, partnerInvitationIdSchema);
    if (!data) return invalid(c);
    return c.json(await cancelPartnerInvitation(c.get('db'), c.get('actor'), data.invitationId));
  });

  app.post('/:id/owners/remove', async (c) => {
    const data = await body(c, partnerOwnerSchema);
    if (!data) return invalid(c);
    return c.json(
      await removePartnerOwner(c.get('db'), c.get('actor'), c.req.param('id'), data.profileId),
    );
  });

  // "Deixar de cuidar…": the actor takes themselves off.
  app.post('/:id/owners/leave', async (c) =>
    c.json(
      await removePartnerOwner(c.get('db'), c.get('actor'), c.req.param('id'), c.get('actorId')),
    ),
  );

  return app;
}
