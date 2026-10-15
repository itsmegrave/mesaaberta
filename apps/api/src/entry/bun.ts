import { Hono } from 'hono';
import { createApi } from '../app';
import { internalToken } from '../internal-token';

// The api on Bun, for a self-hosted deployment (Docker). Same Hono app as the Worker. It listens on
// a private network behind the web app, never on the internet, and refuses a request without the
// shared secret (`API_INTERNAL_TOKEN`), because over HTTP the actor header is only a claim.
const token = process.env.API_INTERNAL_TOKEN ?? '';
if (!token) {
  console.error('API_INTERNAL_TOKEN is required: the api only answers requests that carry it.');
  process.exit(1);
}

const app = new Hono();
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
