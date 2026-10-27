import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { accountRoutes } from '../../../../../api/src/account';
import { adminReadRoutes } from '../../../../../api/src/admin-reads';
import { authRoutes } from '../../../../../api/src/auth';
import { announcementRoutes } from '../../../../../api/src/announcements';
import { catalogRoutes } from '../../../../../api/src/catalog';
import { followRoutes } from '../../../../../api/src/follows';
import { inboxRoutes } from '../../../../../api/src/inbox';
import { meRoutes } from '../../../../../api/src/me';
import { messageRoutes } from '../../../../../api/src/messages';
import { moderationRoutes } from '../../../../../api/src/moderation';
import { partnerRoutes } from '../../../../../api/src/partners';
import { profileRoutes } from '../../../../../api/src/profiles';
import { readRoutes } from '../../../../../api/src/reads';

/**
 * For specs only: an access token the api's stand-in Supabase answers as this user's, for the routes
 * that check the person's own token (`/v1/auth/ensure-profile`).
 */
export const testAccessToken = (user: { id: string; user_metadata?: object }) =>
  encodeURIComponent(JSON.stringify(user));

// The api's Supabase user lookup, answering the user a `testAccessToken` names.
const supabaseUser = (async (_url: string, init?: RequestInit) => {
  const token = new Headers(init?.headers).get('authorization')?.replace(/^Bearer /, '') ?? '';
  try {
    return Response.json(JSON.parse(decodeURIComponent(token)));
  } catch {
    return Response.json({ message: 'invalid token' }, { status: 401 });
  }
}) as typeof fetch;

/**
 * For specs that mock the core readers: a stand-in database that answers only the api guards'
 * lookup of the actor, with these profiles (a visitor when empty). Whatever else is read must be
 * mocked.
 */
export const actorsOnly = (actors: { id: string; role: string; status: string }[] = []) =>
  ({
    select: () => ({ from: () => ({ where: async () => actors }) }),
  }) as unknown as AnyDb;

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
    ['/v1/follows', followRoutes(open)],
    ['/v1/account', accountRoutes(open)],
    ['/v1/partners', partnerRoutes(open)],
    ['/v1/auth', authRoutes(open, undefined, { request: supabaseUser })],
  ] as const;
  const bindings = {
    DATABASE_URL: 'postgres://test',
    SUPABASE_URL: 'https://supabase.test',
    SUPABASE_PUBLISHABLE_KEY: 'test-key',
    ...env,
  };
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
