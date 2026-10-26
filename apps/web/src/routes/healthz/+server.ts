import { checkDatabase } from '@mesaaberta/core/server/db/health';
import { buildInfoOf, type BuildEnv } from '@mesaaberta/core/server/build-info';
import { workerHealth } from '@mesaaberta/core/server/events/heartbeat';
import { probeApi } from '#lib/server/api-health.js';
import type { RequestHandler } from './$types';

// Liveness and dependency probe for uptime checks. 503 when the database is configured but does
// not answer; a deploy with no database configured yet still reports ok. Each app says which build
// it runs (`version`, the release; `revision`, the source commit), as the deploy pipeline sets
// them: absent on local and self-hosted runs that do not. `api` is asked over its binding; `worker`
// is read from its last sweep (it has no route to probe): `stale` after 15 minutes without one.
// Neither changes `status` or the HTTP code, so a rollback of one app cannot fail the web health
// gate. The top-level `revision` is the web one, kept while the deploy smoke and uptime checks
// still read it there.
export const GET: RequestHandler = async ({ locals }) => {
  const [database, api] = await Promise.all([
    checkDatabase(locals.db, locals.log),
    probeApi(locals.env),
  ]);
  const healthy = database !== 'down';
  const web = buildInfoOf(locals.env as BuildEnv | undefined);
  const worker = database === 'ok' && locals.db ? await workerHealth(locals.db) : undefined;

  return Response.json(
    {
      status: healthy ? 'ok' : 'error',
      database,
      ...(web.revision ? { revision: web.revision } : {}),
      web: { status: 'ok', ...web },
      api,
      ...(worker ? { worker } : {}),
    },
    { status: healthy ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
};
