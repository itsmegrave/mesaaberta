import { Hono } from 'hono';
import { REQUEST_ID_HEADER, requestIdFrom, withRequestId } from '@mesaaberta/contracts';
import { logger } from '@mesaaberta/core/server/logger';
import { buildInfoOf, type BuildEnv } from '@mesaaberta/core/server/build-info';
import type { DatabaseEnv } from '@mesaaberta/core/server/db/client';
import { accountRoutes } from './account';
import { ACTOR_HEADER } from './admin-guard';
import { adminReadRoutes } from './admin-reads';
import { announcementRoutes } from './announcements';
import { authRoutes } from './auth';
import { catalogRoutes } from './catalog';
import { eventRoutes } from './events';
import { extensionRoutes } from './extensions';
import { followRoutes } from './follows';
import { storeHealth } from './health';
import { partnerRoutes } from './partners';
import { placeRoutes } from './places';
import { crowdfundingRoutes } from './crowdfundings';
import { inboxRoutes } from './inbox';
import { locationRoutes } from './location';
import { invitationRoutes } from './invitations';
import { manageRoutes } from './manage';
import { meRoutes } from './me';
import { messageRoutes } from './messages';
import { moderationRoutes } from './moderation';
import { passwordRoutes } from './password';
import { profileRoutes } from './profiles';
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

  // Which build answers, so the web /healthz can show a mismatch after a one-app rollback. With
  // `?deep=1` (the web /healthz, behind its token) also the database and the background Worker.
  app.get('/healthz', async (c) => {
    const build = { status: 'ok', service: 'api', ...buildInfoOf(c.env as BuildEnv | undefined) };
    if (c.req.query('deep') !== '1') return c.json(build);
    return c.json({ ...build, ...(await storeHealth(c.env as DatabaseEnv | undefined)) });
  });

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
  // The writes (Trello #120) live here only; web has no fallback. The admin event actions:
  app.route('/v1/admin/events', eventRoutes());
  // the catalog console's decisions:
  app.route('/v1/admin/catalog', catalogRoutes());
  // the moderation decisions:
  app.route('/v1/admin/moderation', moderationRoutes());
  // the announcements console (confirm, then send).
  app.route('/v1/admin/announcements', announcementRoutes());
  // The admin's hand actions on an installed extension (Instagram: queue, reconcile, connect),
  // behind `api_admin_<extension>`. After the routes above, which have a path of their own.
  app.route('/v1/admin', extensionRoutes());
  // Join, leave and the GM's decisions.
  app.route('/v1/tables', tableWriteRoutes(undefined, true));

  app.route('/v1', invitationRoutes());
  app.route('/v1/tables', registrationRoutes());
  // The GM's manage page (publish, happened, not held, postpone).
  app.route('/v1/manage', manageRoutes());
  // The GM's table record (create, edit, disable).
  app.route('/v1/table-writes', tableWriteRoutes());
  // Conversations and the notification feed (send, mute, open, read).
  app.route('/v1/inbox', inboxRoutes());
  // Mensagens: the inbox, a thread, the read mark, a table's chat, blocking and reporting.
  app.route('/v1/messages', messageRoutes());
  // What a member submits (partners, crowdfunding campaigns).
  app.route('/v1/submissions', submissionRoutes());
  // Reporting a table, partner or campaign and withdrawing one's own partner.
  app.route('/v1/reports', reportRoutes());
  // Adding a password to a provider-only account (a code by e-mail, then the password). Before
  // `/v1/account`, whose `/:action` would otherwise catch it.
  app.route('/v1/account/password', passwordRoutes());
  // The auth forms (password reset, sign-in, sign-up, new password, finish login).
  app.route('/v1/auth', authRoutes());
  // The signed-in person's own frame: the profile row (the actor of every web request), the
  // header's numbers and the bell, and the notification feed.
  app.route('/v1/me', meRoutes());
  // The address behind a CEP, for the forms that fill one in.
  app.route('/v1/location', locationRoutes());
  // Seguir: the button, "Seguindo" and its bell switches.
  app.route('/v1/follows', followRoutes());
  // Parceiros: the list, a partner's edit form and "Quem cuida do parceiro".
  app.route('/v1/partners', partnerRoutes());
  // Onde jogar: sending, editing and claiming a place.
  app.route('/v1/places', placeRoutes());
  // Financiamentos: the list and the add form's checks.
  app.route('/v1/crowdfundings', crowdfundingRoutes());
  // The person's own profile (the form and the direct-messages switch).
  app.route('/v1/account', accountRoutes());

  // The page readers: the web Worker reads no database for these pages.
  app.route('/v1/reads', readRoutes());
  // The public sitemap's identifiers (published tables, active profiles). New and anonymous, so no
  // flag and no web fallback: web answers 503 when this read fails.
  app.route('/v1/seo', seoRoutes());
  // The public profile page (/u/[username]). No flag and no web fallback either: database reads
  // live in the api now, and web answers 503 when this one fails.
  app.route('/v1/profiles', profileRoutes());
  // The admin pages' data (overview, users, tables).
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
