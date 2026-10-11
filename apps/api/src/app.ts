import { Hono } from 'hono';

/**
 * The api app of Trello #120: the one place writes, policies and the outbox will live once routes
 * move out of the web app, behind `api_<area>` flags (strangler: the web app stays the default).
 * Today it answers a health probe and nothing else. It is not deployed, has no routes or crons, and
 * is reached by the web Worker through a Service Binding, never from the internet.
 */
export function createApi() {
  const app = new Hono();

  app.get('/healthz', (c) => c.json({ status: 'ok', service: 'api' }));

  // JSON everywhere, so a caller never has to parse an HTML error page.
  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((_error, c) => c.json({ error: 'internal_error' }, 500));

  return app;
}

export type Api = ReturnType<typeof createApi>;
