import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { adminReadRoutes } from '../../../../../api/src/admin-reads';
import { profileRoutes } from '../../../../../api/src/profiles';
import { readRoutes } from '../../../../../api/src/reads';

/**
 * For specs only: an `env` whose `API` binding answers from the api Worker's own read routes over
 * the test database, so a web page reader runs end to end the way it does in production (the web
 * Worker reads no database for these pages).
 */
export function apiOver(db: AnyDb, env: Record<string, string> = {}) {
  const open = (() => ({ db, close: async () => {} })) as never;
  const mounted = [
    ['/v1/reads', readRoutes(open)],
    ['/v1/admin-reads', adminReadRoutes(open)],
    ['/v1/profiles', profileRoutes(open)],
  ] as const;
  const bindings = { DATABASE_URL: 'postgres://test', ...env };
  return {
    ...env,
    API: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        const found = mounted.find(([prefix]) => url.pathname.startsWith(`${prefix}/`));
        if (!found) return Response.json({ error: 'not_found' }, { status: 404 });
        url.pathname = url.pathname.slice(found[0].length);
        return found[1].fetch(new Request(url, request), bindings);
      },
    },
  };
}
