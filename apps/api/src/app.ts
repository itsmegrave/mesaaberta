import { Hono } from 'hono';
import { catalogRoutes } from './catalog';
import { eventRoutes } from './events';
import { moderationRoutes } from './moderation';
import { registrationRoutes } from './registrations';

/**
 * The api app of Trello #120: the one place writes, policies and the outbox will live once routes
 * move out of the web app, behind `api_<area>` flags (strangler: the web app stays the default).
 * Today it answers a health probe and the admin event actions. It has no crons and is reached by
 * the web Worker through a Service Binding, never from the internet.
 */
export function createApi() {
  const app = new Hono();

  app.get('/healthz', (c) => c.json({ status: 'ok', service: 'api' }));
  // The first moved route (Trello #120): the admin event actions, behind `api_admin_events` on web.
  app.route('/v1/admin/events', eventRoutes());
  // The second: the catalog console's decisions, behind `api_admin_catalog` on web.
  app.route('/v1/admin/catalog', catalogRoutes());
  // The third: the moderation decisions, behind `api_admin_moderation` on web.
  app.route('/v1/admin/moderation', moderationRoutes());
  // The first player-facing one: join, leave and the GM's decisions, behind `api_registrations`.
  app.route('/v1/tables', registrationRoutes());

  // JSON everywhere, so a caller never has to parse an HTML error page.
  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((_error, c) => c.json({ error: 'internal_error' }, 500));

  return app;
}

export type Api = ReturnType<typeof createApi>;
