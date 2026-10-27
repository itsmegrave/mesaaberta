import { Hono } from 'hono';
import { viewerSegments } from '@mesaaberta/core/server/audience/segments';
import type { createDb, DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { createDb as openDb } from '@mesaaberta/core/server/db/client';
import {
  extensionById,
  extensions,
  widgetExtensions,
  type Extension,
} from '@mesaaberta/core/server/extensions/index';
import { apiFlags, type FlagsEnv } from './flags';
import { userGuard, viewerGuard, type UserVariables } from './user-guard';

type Open = typeof createDb;

/**
 * The installed extensions' widgets and public assets (Trello #120). Which pages show widgets at
 * all stays in web (`showsWidgets`); which widgets exist, where and for whom is the extensions'
 * business, with the flags they declare read here.
 */
export function widgetRoutes(open: Open = openDb, installed: readonly Extension[] = extensions) {
  const app = new Hono<{ Bindings: DatabaseEnv & FlagsEnv; Variables: UserVariables }>();

  // A public asset (an image Meta fetches without cookies): a random, expiring key, so no actor.
  app.get('/assets/:ext/:key', viewerGuard(open), async (c) => {
    const asset = extensionById(c.req.param('ext'), installed)?.asset;
    const found = asset && (await asset(c.get('db'), c.req.param('key')));
    if (!found) return c.json({ error: 'not_found' }, 404);
    return c.body(found.body, 200, { 'content-type': found.type });
  });

  // A widget on its own page, for anyone (a poll's public results).
  app.get('/:ext/:id', viewerGuard(open), async (c) => {
    const surface = extensionById(c.req.param('ext'), installed)?.widgets;
    const widget = surface?.page
      ? await surface.page(c.get('db'), c.req.param('id'), apiFlags(c.env))
      : null;
    if (!widget) return c.json({ error: 'not_found' }, 404);
    return c.json({ widget });
  });

  app.use('/*', userGuard(open));

  // `?route=/t/[slug]`: the widgets the actor may see there, most important first. None for an
  // account that widgets never aim at (suspended, still onboarding).
  app.get('/', async (c) => {
    const db = c.get('db');
    const route = c.req.query('route') ?? '';
    const segments = await viewerSegments(db, c.get('actorId'));
    const widgets: { ext: string; widget: unknown }[] = [];
    if (segments && route) {
      const viewer = { id: c.get('actorId'), segments };
      const flags = apiFlags(c.env);
      for (const extension of widgetExtensions(installed))
        for (const widget of await extension.widgets.forViewer(db, viewer, route, flags))
          widgets.push({ ext: extension.id, widget });
    }
    return c.json({ widgets });
  });

  // An answer from a widget's form (`{ fields }`): the widget as it now stands, `invalid` (400) for
  // fields the extension refuses, or 404 when there is no such widget for this person.
  app.post('/:ext/:id', async (c) => {
    const surface = extensionById(c.req.param('ext'), installed)?.widgets;
    const db = c.get('db');
    const segments = surface ? await viewerSegments(db, c.get('actorId')) : null;
    if (!surface || !segments) return c.json({ error: 'not_found' }, 404);
    const body = (await c.req.json().catch(() => null)) as { fields?: unknown } | null;
    const fields = Object.fromEntries(
      Object.entries(
        body?.fields && typeof body.fields === 'object' ? (body.fields as object) : {},
      ).filter(([, value]) => typeof value === 'string'),
    ) as Record<string, string>;
    const answer = await surface.respond(
      db,
      { id: c.get('actorId'), segments },
      c.req.param('id'),
      fields,
      apiFlags(c.env),
    );
    if (!answer) return c.json({ error: 'not_found' }, 404);
    if ('invalid' in answer)
      return c.json({ error: 'invalid', field: '', message: 'invalid' }, 400);
    return c.json({ widget: answer.widget });
  });

  return app;
}
