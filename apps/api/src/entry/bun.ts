import { Hono } from 'hono';
import { setAppName } from '@mesaaberta/core/server/logger';
import { createHttpMetrics } from '@mesaaberta/core/server/metrics';
import { createApi } from '../app';
import { internalToken } from '../internal-token';

// The api on Bun, for a self-hosted deployment (Docker). Same Hono app as the Worker. It listens on
// a private network behind the web app, never on the internet, and refuses a request without the
// shared secret (`API_INTERNAL_TOKEN`), because over HTTP the actor header is only a claim.
setAppName('api');

const token = process.env.API_INTERNAL_TOKEN ?? '';
if (!token) {
  console.error('API_INTERNAL_TOKEN is required: the api only answers requests that carry it.');
  process.exit(1);
}

const app = new Hono();
const metrics = createHttpMetrics('api');
// Counts every request by its route template, the refused ones included.
app.use('*', async (c, next) => {
  const started = performance.now();
  await next();
  metrics.observe({
    route: c.req.routePath === '/*' ? '/unmatched' : c.req.routePath,
    method: c.req.method,
    status: c.res.status,
    seconds: (performance.now() - started) / 1000,
  });
});
// Open like the probe: the api listens on the private network only, and the numbers name no one.
app.get('/metrics', (c) =>
  c.text(metrics.render(), 200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' }),
);
// The probe is open (a container health check has no secret); everything else needs the token.
app.get('/healthz', (c) => c.json({ status: 'ok', service: 'api' }));
app.use('/v1/*', internalToken(token));
app.route('/', createApi());

const server = Bun.serve({
  port: Number(process.env.PORT ?? 8788),
  // Hono passes this as `c.env`, where the routes read DATABASE_URL and the mail and Auth settings.
  fetch: (request) => app.fetch(request, process.env),
});
console.log(`api listening on :${server.port}`);
