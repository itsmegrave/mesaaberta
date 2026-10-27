import { buildInfoOf, type BuildEnv } from '@mesaaberta/core/server/build-info';
import { sameSecret } from '@mesaaberta/core/server/same-secret';
import { probeApi } from '#lib/server/api-health.js';
import type { RequestHandler } from './$types';

type HealthEnv = BuildEnv & { HEALTHZ_TOKEN?: string };

/** Whether the request carries `Authorization: Bearer <HEALTHZ_TOKEN>`. Never with no token set. */
function authorized(request: Request, env: HealthEnv | undefined) {
  const sent = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1] ?? '';
  return sameSecret(sent, env?.HEALTHZ_TOKEN?.trim() ?? '');
}

// Health probe for the uptime monitor and the deploy gate, which both send the `HEALTHZ_TOKEN`
// secret as a bearer token. Without it the answer is a 401 that touches neither the database nor
// the api, so the probe is not a cheap way to load them; with no token configured nobody gets in.
// The api is the one app that opens the database, so it answers for it and for the background
// Worker (read from its last sweep, `stale` after 15 minutes without one). 503 when the database
// is configured but does not answer; a deploy with no database configured yet still reports ok,
// and so does an api that cannot be asked (the database is then `unknown`), so a rollback of one
// app cannot fail the web health gate. Each app says which build it runs (`version`, the release;
// `revision`, the source commit), absent on runs whose pipeline does not set them. The top-level
// `revision` is the web one, which the deploy gate reads.
export const GET: RequestHandler = async ({ locals, request }) => {
  const env = locals.env as HealthEnv | undefined;
  const headers = { 'cache-control': 'no-store' };
  if (!authorized(request, env)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  }

  const { api, store } = await probeApi(locals.env);
  const healthy = store.database !== 'down';
  const web = buildInfoOf(env);
  return Response.json(
    {
      status: healthy ? 'ok' : 'error',
      database: store.database,
      ...(web.revision ? { revision: web.revision } : {}),
      web: { status: 'ok', ...web },
      api,
      ...(store.worker ? { worker: store.worker } : {}),
    },
    { status: healthy ? 200 : 503, headers },
  );
};
