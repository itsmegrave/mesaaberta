import { json } from '@sveltejs/kit';
import { checkDatabase } from '@mesaaberta/core/server/db/health';
import { workerHealth } from '@mesaaberta/core/server/events/heartbeat';
import type { RequestHandler } from './$types';

type HealthEnv = { DEPLOYMENT_SOURCE_SHA?: string };

// Liveness and dependency probe for uptime checks. 503 when the database is configured but does
// not answer; a deploy with no database configured yet still reports ok. `revision` is the
// source commit the serving version was built from, set by the deployment pipeline; it is
// absent on local and self-hosted runs that do not set it. `worker` is the background Worker's last
// sweep (it has no route to probe): `stale` after 15 minutes without one. It never changes `status`
// or the HTTP code, so a worker rollback cannot fail the web health gate.
export const GET: RequestHandler = async ({ locals }) => {
  const database = await checkDatabase(locals.db, locals.log);
  const healthy = database !== 'down';
  const revision = (locals.env as HealthEnv | undefined)?.DEPLOYMENT_SOURCE_SHA?.trim();
  const worker = database === 'ok' && locals.db ? await workerHealth(locals.db) : undefined;

  return json(
    {
      status: healthy ? 'ok' : 'error',
      database,
      ...(revision ? { revision } : {}),
      ...(worker ? { worker } : {}),
    },
    { status: healthy ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
};
