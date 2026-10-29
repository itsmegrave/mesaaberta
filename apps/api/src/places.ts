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
import { refusal } from './refusal';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;
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

  // "Deixar de gerenciar": the owner hands the place back, by its id.
  app.post('/:id/release', async (c) => {
    return c.json({
      eventIds: await removePlaceOwner(c.get('db'), c.get('actor'), c.req.param('id')),
    });
  });

  return app;
}
