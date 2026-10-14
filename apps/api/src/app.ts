import { Hono } from 'hono';
import { accountRoutes } from './account';
import { catalogRoutes } from './catalog';
import { eventRoutes } from './events';
import { inboxRoutes } from './inbox';
import { manageRoutes } from './manage';
import { moderationRoutes } from './moderation';
import { registrationRoutes } from './registrations';
import { tableWriteRoutes } from './table-writes';

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
  // The GM's manage page (publish, happened, not held, postpone), behind `api_table_lifecycle`.
  app.route('/v1/manage', manageRoutes());
  // The GM's table record (create, edit, disable), behind `api_table_write`.
  app.route('/v1/table-writes', tableWriteRoutes());
  // Conversations and the notification feed (send, mute, open, read), behind `api_inbox`.
  app.route('/v1/inbox', inboxRoutes());
  // The person's own profile (the form and the direct-messages switch), behind `api_account`.
  app.route('/v1/account', accountRoutes());

  // JSON everywhere, so a caller never has to parse an HTML error page.
  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((_error, c) => c.json({ error: 'internal_error' }, 500));

  return app;
}

export type Api = ReturnType<typeof createApi>;
