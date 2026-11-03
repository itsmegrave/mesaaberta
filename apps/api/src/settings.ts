import { Hono } from 'hono';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import {
  extensionById,
  extensions,
  settingsCardsFor,
  type Extension,
} from '@mesaaberta/core/server/extensions/index';
import { apiFlags, type FlagsEnv } from './flags';
import { userGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

/**
 * The installed extensions' cards on a person's own "Editar perfil" (a supporter's avatar frame).
 * Which card a person gets, and what a save changes, is the extension's business.
 */
export function settingsRoutes(open: Open = openDb, installed: readonly Extension[] = extensions) {
  const app = new Hono<{ Bindings: DatabaseEnv & FlagsEnv; Variables: UserVariables }>();
  app.use('/*', userGuard(open));

  // The actor's cards, in install order.
  app.get('/', async (c) =>
    c.json({
      cards: await settingsCardsFor(c.get('db'), c.get('actorId'), apiFlags(c.env), installed),
    }),
  );

  // A save from a card's form (`{ fields }`): the card as it now stands, `invalid` (400) for fields
  // the extension refuses, or 404 when the extension has no settings.
  app.post('/:ext', async (c) => {
    const surface = extensionById(c.req.param('ext'), installed)?.settings;
    if (!surface) return c.json({ error: 'not_found' }, 404);
    const body = (await c.req.json().catch(() => null)) as { fields?: unknown } | null;
    const fields = Object.fromEntries(
      Object.entries(
        body?.fields && typeof body.fields === 'object' ? (body.fields as object) : {},
      ).filter(([, value]) => typeof value === 'string'),
    ) as Record<string, string>;
    const answer = await surface.save(c.get('db'), c.get('actorId'), fields, apiFlags(c.env));
    if ('invalid' in answer)
      return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);
    return c.json({ card: answer.card });
  });

  return app;
}
