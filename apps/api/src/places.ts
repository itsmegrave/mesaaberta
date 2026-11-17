import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import { can } from '@mesaaberta/core/server/auth/policy';
import { placeInputSchema, type PlaceInput } from '@mesaaberta/core/places/schema';
import { placeClaimSchema } from '@mesaaberta/core/places/claims';
import {
  findEditablePlace,
  submitPlace,
  updatePlace,
} from '@mesaaberta/core/server/places/service';
import { readPlacePage } from '@mesaaberta/core/server/places/directory';
import { listFeatureOptions } from '@mesaaberta/core/server/places/features';
import { fileClaim, pendingClaimOf, removePlaceOwner } from '@mesaaberta/core/server/places/claims';
import { placePartnerRequestSchema } from '@mesaaberta/core/places/partner-links';
import {
  endPlacePartner,
  placePartnerState,
  requestPlacePartner,
} from '@mesaaberta/core/server/places/partner-links';
import {
  placeHostInvitationIdSchema,
  placeHostInviteSchema,
  placeHostLeaveSchema,
  placeHostSchema,
} from '@mesaaberta/core/places/hosts';
import {
  cancelPlaceHostInvitation,
  hostedPlacesOf,
  invitePlaceHost,
  listPlaceHosts,
  loadPlaceHostInvitation,
  placeIdOf,
  removePlaceHost,
  respondToPlaceHostInvitation,
} from '@mesaaberta/core/server/places/hosts';
import { refusal } from './refusal';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

const id = z.guid();
type Ctx = Context<{ Bindings: DatabaseEnv; Variables: UserVariables }>;

/** A photo the web Worker already stored, as a path in the bucket (never a URL, never a file). */
const storedPath = z
  .string()
  .max(300)
  .regex(/^[A-Za-z0-9/_.-]+$/);
const placeBody = z.object({
  input: placeInputSchema,
  imagePath: storedPath.nullable().default(null),
});

/**
 * "Cadastrar lugar", "Editar lugar" and "Este lugar é seu?" (Trello #120): web checks the
 * `api_directory_places` flag, validates the form and stores the photo; the services here
 * authorize. Writes answer `{ eventIds, slug, ... }`.
 */
export function placeRoutes(open: Open = openDb) {
  const app = new Hono<{ Bindings: DatabaseEnv; Variables: UserVariables }>();

  app.use('*', userGuard(open));
  app.onError((error, c) => {
    const refused = refusal(c, error);
    if (refused) return refused;
    throw error;
  });

  const parsed = async (c: Ctx) => {
    const body = placeBody.safeParse(await c.req.json().catch(() => null));
    return body.success ? (body.data as { input: PlaceInput; imagePath: string | null }) : null;
  };
  const invalid = (c: Ctx) => c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);

  // "Quem mestra na casa": the invite page and its answer, for the person invited only, and the
  // places where the actor is a house GM (Editar perfil, to leave one). Never gated, so an invite
  // that was sent can always be answered.
  app.get('/hosts/invitations/:id', async (c) => {
    if (!id.safeParse(c.req.param('id')).success) return c.json({ error: 'not_found' }, 404);
    return c.json(await loadPlaceHostInvitation(c.get('db'), c.get('actor'), c.req.param('id')));
  });
  app.post('/hosts/invitations/:id/:decision{accept|decline}', async (c) => {
    if (!id.safeParse(c.req.param('id')).success) return c.json({ error: 'not_found' }, 404);
    const decision = c.req.param('decision') as 'accept' | 'decline';
    return c.json(
      await respondToPlaceHostInvitation(c.get('db'), c.get('actor'), c.req.param('id'), decision),
    );
  });
  app.get('/hosted', async (c) =>
    c.json((await hostedPlacesOf(c.get('db'), [c.get('actorId')])).get(c.get('actorId')) ?? []),
  );

  app.post('/', async (c) => {
    const body = await parsed(c);
    if (!body) return invalid(c);
    const { eventId, slug } = await submitPlace(c.get('db'), c.get('actor'), body.input, {
      imagePath: body.imagePath,
    });
    return c.json({ eventIds: [eventId], slug });
  });

  // An edit, by the place's slug (the one the person may edit; 403/404 otherwise).
  app.post('/:slug', async (c) => {
    const body = await parsed(c);
    if (!body) return invalid(c);
    const place = await findEditablePlace(c.get('db'), c.get('actor'), c.req.param('slug'));
    const { eventId, slug, replacedImage } = await updatePlace(
      c.get('db'),
      c.get('actor'),
      place.id,
      body.input,
      { imagePath: body.imagePath },
    );
    return c.json({ eventIds: [eventId], slug, replacedImage });
  });

  // What the place form's Tags offer: the approved catalog and the actor's own suggestions waiting,
  // or only the old Comodidades with `?legacy=1` (web asks for that while `use_place_tags` is off).
  app.get('/tag-options', async (c) =>
    c.json(
      await listFeatureOptions(
        c.get('db'),
        c.req.query('legacy') === '1' ? { legacyOnly: true } : { suggestedBy: c.get('actor').id },
      ),
    ),
  );

  // The edit form of a place the actor may edit (403/404 otherwise).
  app.get('/:slug/edit', async (c) =>
    c.json(await findEditablePlace(c.get('db'), c.get('actor'), c.req.param('slug'))),
  );

  // The claim page: a listed place (not pending, not hidden) and the actor's claim waiting on it.
  app.get('/:slug/claim', async (c) => {
    const actor = c.get('actor');
    const found = await readPlacePage(
      c.get('db'),
      c.req.param('slug'),
      { id: actor.id, isAdmin: can(actor, 'admin:access') },
      new Date(),
    );
    if (!found || found.pending || found.hidden) return c.json({ error: 'not_found' }, 404);
    const waiting = found.claimable
      ? await pendingClaimOf(c.get('db'), found.place.id, actor.id)
      : null;
    return c.json({
      place: { slug: found.place.slug, name: found.place.name },
      owner: found.owner,
      claimable: found.claimable,
      waiting: waiting !== null,
    });
  });

  app.post('/:slug/claim', async (c) => {
    const body = placeClaimSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return invalid(c);
    const eventIds = await fileClaim(c.get('db'), c.get('actor'), c.req.param('slug'), body.data);
    return c.json({ eventIds });
  });

  // "Parceiro" on the place's edit page (`use_directory_links`, checked by web): the link that is up,
  // the request that waits and the partners the actor could ask for; 404 for anyone but its owner
  // and admins.
  app.get('/:slug/partner', async (c) => {
    const state = await placePartnerState(c.get('db'), c.get('actor'), c.req.param('slug'));
    return state ? c.json(state) : c.json({ error: 'not_found' }, 404);
  });

  app.post('/:slug/partner', async (c) => {
    const body = placePartnerRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return invalid(c);
    return c.json({
      eventIds: await requestPlacePartner(
        c.get('db'),
        c.get('actor'),
        c.req.param('slug'),
        body.data.partnerId,
      ),
    });
  });

  // Withdrawing the request that waits, or taking the link that is up down.
  app.post('/:slug/partner/:which{cancel|remove}', async (c) => {
    const which = c.req.param('which') === 'cancel' ? 'pending' : 'approved';
    return c.json({
      eventIds: await endPlacePartner(c.get('db'), c.get('actor'), c.req.param('slug'), which),
    });
  });

  // "Quem mestra na casa" on the edit page (`use_directory_links`, checked by web): its owner or an
  // admin invites, cancels an invite and takes someone off; a house GM takes themself off.
  app.get('/:slug/hosts', async (c) =>
    c.json(await listPlaceHosts(c.get('db'), c.get('actor'), c.req.param('slug'))),
  );
  app.post('/:slug/hosts/invite', async (c) => {
    const body = placeHostInviteSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return invalid(c);
    const placeId = await placeIdOf(c.get('db'), c.req.param('slug'));
    return c.json(await invitePlaceHost(c.get('db'), c.get('actor'), placeId, body.data.username));
  });
  app.post('/:slug/hosts/cancel', async (c) => {
    const body = placeHostInvitationIdSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return invalid(c);
    return c.json(
      await cancelPlaceHostInvitation(c.get('db'), c.get('actor'), body.data.invitationId),
    );
  });
  app.post('/:slug/hosts/remove', async (c) => {
    const body = placeHostSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return invalid(c);
    const placeId = await placeIdOf(c.get('db'), c.req.param('slug'));
    return c.json(await removePlaceHost(c.get('db'), c.get('actor'), placeId, body.data.profileId));
  });
  // "Sair" from Editar perfil: a house GM leaves a place, by its id.
  app.post('/hosts/leave', async (c) => {
    const body = placeHostLeaveSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return invalid(c);
    return c.json(
      await removePlaceHost(c.get('db'), c.get('actor'), body.data.placeId, c.get('actorId')),
    );
  });

  // "Deixar de gerenciar": the owner hands the place back, by its id.
  app.post('/:id/release', async (c) => {
    return c.json({
      eventIds: await removePlaceOwner(c.get('db'), c.get('actor'), c.req.param('id')),
    });
  });

  return app;
}
