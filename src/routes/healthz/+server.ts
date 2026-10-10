import { json } from '@sveltejs/kit';
import { checkDatabase } from '$lib/server/db/health';
import type { RequestHandler } from './$types';

type HealthEnv = { DEPLOYMENT_SOURCE_SHA?: string };

// Liveness and dependency probe for uptime checks. 503 when the database is configured but does
// not answer; a deploy with no database configured yet still reports ok. `revision` is the
// source commit the serving version was built from, set by the deployment pipeline; it is
// absent on local and self-hosted runs that do not set it.
export const GET: RequestHandler = async ({ locals, platform }) => {
  const database = await checkDatabase(locals.db, locals.log);
  const healthy = database !== 'down';
  const revision = (platform?.env as HealthEnv | undefined)?.DEPLOYMENT_SOURCE_SHA?.trim();

  return json(
    { status: healthy ? 'ok' : 'error', database, ...(revision ? { revision } : {}) },
    { status: healthy ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
};
