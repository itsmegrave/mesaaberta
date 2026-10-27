import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { accountRoutes } from '../../../../../api/src/account';
import { adminReadRoutes } from '../../../../../api/src/admin-reads';
import { announcementRoutes } from '../../../../../api/src/announcements';
import { catalogRoutes } from '../../../../../api/src/catalog';
import { inboxRoutes } from '../../../../../api/src/inbox';
import { meRoutes } from '../../../../../api/src/me';
import { messageRoutes } from '../../../../../api/src/messages';
import { moderationRoutes } from '../../../../../api/src/moderation';
import { profileRoutes } from '../../../../../api/src/profiles';
import { readRoutes } from '../../../../../api/src/reads';

/**
 * For specs only: an `env` whose `API` binding answers from the api Worker's own routes over the
 * test database, so a web page or form action runs end to end the way it does in production (the
 * web Worker reads and writes no database for these).
 */
export function apiOver(db: AnyDb, env: Record<string, string> = {}) {
  const open = (() => ({ db, close: async () => {} })) as never;
  const mounted = [
    ['/v1/reads', readRoutes(open)],
    ['/v1/admin-reads', adminReadRoutes(open)],
    ['/v1/profiles', profileRoutes(open)],
    ['/v1/admin/catalog', catalogRoutes(open)],
    ['/v1/admin/moderation', moderationRoutes(open)],
    ['/v1/admin/announcements', announcementRoutes(open)],
    ['/v1/inbox', inboxRoutes(open)],
    ['/v1/messages', messageRoutes(open)],
    ['/v1/me', meRoutes(open)],
    ['/v1/account', accountRoutes(open)],
  ] as const;
  const bindings = { DATABASE_URL: 'postgres://test', ...env };
  return {
    ...env,
    API: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        const found = mounted.find(
          ([prefix]) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
        );
        if (!found) return Response.json({ error: 'not_found' }, { status: 404 });
        url.pathname = url.pathname.slice(found[0].length) || '/';
        return found[1].fetch(new Request(url, request), bindings);
      },
    },
  };
}
