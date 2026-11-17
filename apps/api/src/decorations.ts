import { Hono } from 'hono';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import {
  decorationsFor,
  extensions,
  type Extension,
} from '@mesaaberta/core/server/extensions/index';
import { apiFlags, type FlagsEnv } from './flags';
import { viewerGuard, type ViewerVariables } from './user-guard';

type Open = typeof createDb;

/**
 * What the installed extensions draw on people (a frame around an avatar, a mark on a profile).
 * Public: anyone may read it, signed in or not. A build with no extension that decorates answers
 * an empty map without opening the database.
 */
export function decorationRoutes(
  open: Open = openDb,
  installed: readonly Extension[] = extensions,
) {
  const app = new Hono<{ Bindings: DatabaseEnv & FlagsEnv; Variables: ViewerVariables }>();
  const decorating = installed.some((extension) => extension.decorations);

  // `?u=ana,bia`: the decorations of these usernames, by lowercase username.
  const guard = viewerGuard(open);
  app.get(
    '/',
    (c, next) => (decorating ? guard(c, next) : c.json({ decorations: {} })),
    async (c) => {
      const usernames = (c.req.query('u') ?? '').split(',');
      const decorations = await decorationsFor(c.get('db'), usernames, apiFlags(c.env), installed);
      return c.json({ decorations });
    },
  );

  return app;
}
