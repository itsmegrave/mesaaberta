import { checkDatabase } from '@mesaaberta/core/server/db/health';
import { buildInfoOf, type BuildEnv } from '@mesaaberta/core/server/build-info';
import { workerHealth } from '@mesaaberta/core/server/events/heartbeat';
import { sameSecret } from '@mesaaberta/core/server/same-secret';
import { probeApi } from '#lib/server/api-health.js';
import type { RequestHandler } from './$types';

type HealthEnv = BuildEnv & { HEALTHZ_TOKEN?: string };

/** Whether the request carries `Authorization: Bearer <HEALTHZ_TOKEN>`. Never with no token set. */
function canSeeDetails(request: Request, env: HealthEnv | undefined) {
  const sent = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1] ?? '';
  return sameSecret(sent, env?.HEALTHZ_TOKEN?.trim() ?? '');
}

// Liveness and dependency probe for uptime checks. 503 when the database is configured but does
// not answer; a deploy with no database configured yet still reports ok. Anyone gets only `status`
// and `database`, which costs one query. The build each app runs (`version`, the release;
// `revision`, the source commit, absent on runs whose pipeline does not set them), the api's
// latency and the worker's last sweep are for the deploy gate and the release checks, which send
// the `HEALTHZ_TOKEN` secret as a bearer token. `api` is asked over its binding; `worker` is read
// from its last sweep (it has no route to probe): `stale` after 15 minutes without one. Neither
// changes `status` or the HTTP code, so a rollback of one app cannot fail the web health gate. The
// top-level `revision` is the web one, which the deploy gate reads.
export const GET: RequestHandler = async ({ locals, request }) => {
  const env = locals.env as HealthEnv | undefined;
  const detailed = canSeeDetails(request, env);
  const [database, api] = await Promise.all([
    checkDatabase(locals.db, locals.log),
    detailed ? probeApi(locals.env) : undefined,
  ]);
  const healthy = database !== 'down';
  const status = healthy ? 200 : 503;
  const headers = { 'cache-control': 'no-store' };
  const summary = { status: healthy ? 'ok' : 'error', database };
  if (!detailed) return Response.json(summary, { status, headers });

  const web = buildInfoOf(env);
  const worker = database === 'ok' && locals.db ? await workerHealth(locals.db) : undefined;
  return Response.json(
    {
      ...summary,
      ...(web.revision ? { revision: web.revision } : {}),
      web: { status: 'ok', ...web },
      api,
      ...(worker ? { worker } : {}),
    },
    { status, headers },
  );
};
