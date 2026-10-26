import { Hono } from 'hono';
import { REQUEST_ID_HEADER, requestIdFrom, withRequestId } from '@mesaaberta/contracts';
import { logger } from '@mesaaberta/core/server/logger';
import { buildInfoOf, type BuildEnv } from '@mesaaberta/core/server/build-info';
import { accountRoutes } from './account';
import { ACTOR_HEADER } from './admin-guard';
import { adminReadRoutes } from './admin-reads';
import { announcementRoutes } from './announcements';
import { authRoutes } from './auth';
import { catalogRoutes } from './catalog';
import { eventRoutes } from './events';
import { extensionRoutes } from './extensions';
import { inboxRoutes } from './inbox';
import { invitationRoutes } from './invitations';
import { manageRoutes } from './manage';
import { moderationRoutes } from './moderation';
import { passwordRoutes } from './password';
import { registrationRoutes } from './registrations';
import { readRoutes } from './reads';
import { reportRoutes } from './reports';
import { seoRoutes } from './seo';
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

  // The web Worker's request id when it sent one (the only caller), else one of its own: every
  // line and every event the request records carries it, and the answer names it back.
  app.use('*', async (c, next) => {
    const requestId = requestIdFrom(c.req.header(REQUEST_ID_HEADER)) ?? crypto.randomUUID();
    await withRequestId(requestId, next);
    c.header(REQUEST_ID_HEADER, requestId);
  });

  // Which build answers, so the web /healthz can show a mismatch after a one-app rollback.
  app.get('/healthz', (c) =>
    c.json({ status: 'ok', service: 'api', ...buildInfoOf(c.env as BuildEnv | undefined) }),
  );

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
  // The admin's hand actions on an installed extension (Instagram: queue, reconcile, connect),
  // behind `api_admin_<extension>`. After the routes above, which have a path of their own.
  app.route('/v1/admin', extensionRoutes());
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

  // The read side, one resource at a time (the catalog first), behind `api_reads_<resource>`.
  app.route('/v1/reads', readRoutes());
  // The public sitemap's identifiers (published tables, active profiles). New and anonymous, so no
  // flag and no web fallback: web answers 503 when this read fails.
  app.route('/v1/seo', seoRoutes());
  // The admin pages' data (overview, users, tables), behind `api_reads_admin*`.
  app.route('/v1/admin-reads', adminReadRoutes());

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
