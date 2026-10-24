import { Hono } from 'hono';
import { logger } from '@mesaaberta/core/server/logger';
import { accountRoutes } from './account';
import { ACTOR_HEADER } from './admin-guard';
import { announcementRoutes } from './announcements';
import { authRoutes } from './auth';
import { catalogRoutes } from './catalog';
import { eventRoutes } from './events';
import { inboxRoutes } from './inbox';
import { invitationRoutes } from './invitations';
import { instagramRoutes } from './instagram';
import { manageRoutes } from './manage';
import { moderationRoutes } from './moderation';
import { passwordRoutes } from './password';
import { registrationRoutes } from './registrations';
import { reportRoutes } from './reports';
import { submissionRoutes } from './submissions';
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

  // One line per request, so a rollout can be read in Sentry: which route, what answer, how long.
  // The route template, the method, the status, the duration and who asked (the actor the web
  // Worker names): never a path or a body.
  app.use('/v1/*', async (c, next) => {
    const started = Date.now();
    await next();
    logger.info('api request', {
      route: c.req.routePath,
      method: c.req.method,
      userId: c.req.header(ACTOR_HEADER),
      status: c.res.status,
      durationMs: Date.now() - started,
    });
  });
  // The first moved route (Trello #120): the admin event actions, behind `api_admin_events` on web.
  app.route('/v1/admin/events', eventRoutes());
  // The second: the catalog console's decisions, behind `api_admin_catalog` on web.
  app.route('/v1/admin/catalog', catalogRoutes());
  // The third: the moderation decisions, behind `api_admin_moderation` on web.
  app.route('/v1/admin/moderation', moderationRoutes());
  // The announcements console (confirm, then send), behind `api_admin_announcements`.
  app.route('/v1/admin/announcements', announcementRoutes());
  // The admin's hand actions on Instagram posts (queue, reconcile), behind `api_admin_instagram`.
  app.route('/v1/admin/instagram', instagramRoutes());
  // The first player-facing one: join, leave and the GM's decisions, behind `api_registrations`.
  app.route('/v1/tables', tableWriteRoutes(undefined, true));

  app.route('/v1', invitationRoutes());
  app.route('/v1/tables', registrationRoutes());
  // The GM's manage page (publish, happened, not held, postpone), behind `api_table_lifecycle`.
  app.route('/v1/manage', manageRoutes());
  // The GM's table record (create, edit, disable), behind `api_table_write`.
  app.route('/v1/table-writes', tableWriteRoutes());
  // Conversations and the notification feed (send, mute, open, read), behind `api_inbox`.
  app.route('/v1/inbox', inboxRoutes());
  // What a member submits (partners, crowdfunding campaigns), behind `api_submissions`.
  app.route('/v1/submissions', submissionRoutes());
  // Reporting a table, partner or campaign and withdrawing one's own partner, behind `api_reports`.
  app.route('/v1/reports', reportRoutes());
  // Adding a password to a provider-only account (a code by e-mail, then the password), behind
  // `api_password`. Before `/v1/account`, whose `/:action` would otherwise catch it.
  app.route('/v1/account/password', passwordRoutes());
  // The anonymous auth forms (the password-reset e-mail first), behind `api_auth`.
  app.route('/v1/auth', authRoutes());
  // The person's own profile (the form and the direct-messages switch), behind `api_account`.
  app.route('/v1/account', accountRoutes());

  // JSON everywhere, so a caller never has to parse an HTML error page.
  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  // The caller never sees the cause. The logger forwards the error's type, code and stack location to
  // Sentry, never its message, and the route is the template (`/v1/account/password/code`).
  app.onError((error, c) => {
    logger.error('api request failed', {
      route: c.req.routePath,
      method: c.req.method,
      userId: c.req.header(ACTOR_HEADER),
      error,
    });
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}

export type Api = ReturnType<typeof createApi>;
