import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { afterSignIn } from '@mesaaberta/core/server/auth/onboarding';
import { isPersonaKey, PERSONA_PASSWORD, personas } from './personas';

export const DEV_LOGIN_PATH = '/dev/login';
export const DEV_LOGOUT_PATH = '/dev/logout';

const loopback = new Set(['localhost', '127.0.0.1']);

const isLoopbackUrl = (url: string | undefined) => {
  try {
    return url !== undefined && loopback.has(new URL(url).hostname);
  } catch {
    return false;
  }
};

/**
 * Why a dev login is refused here, or null when every gate is open. The build gate (`vite dev`
 * only) is in `hooks.server.ts`; these are the ones a dev build checks on every request.
 */
export function devLoginRefusal(event: Pick<RequestEvent, 'url' | 'locals'>): string | null {
  const env = event.locals.env as { DEV_LOGIN?: string; SUPABASE_URL?: string } | undefined;
  if (env?.DEV_LOGIN !== 'true') return 'DEV_LOGIN is not true';
  if (!loopback.has(event.url.hostname)) return 'the request is not for localhost';
  if (!isLoopbackUrl(env.SUPABASE_URL)) return 'SUPABASE_URL is not a local Supabase';
  if (!event.locals.supabase) return 'auth is off';
  return null;
}

/**
 * `GET /dev/login?as=<persona>&next=<path>` signs in as one of the local personas with the real
 * Supabase login, then redirects as the login form does; `GET /dev/logout` signs out. Anything refused is a 404, like a
 * route that does not exist. Only `vite dev` loads this module (see `hooks.server.ts`).
 */
export const handleDevLogin: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;
  if (pathname !== DEV_LOGIN_PATH && pathname !== DEV_LOGOUT_PATH) return resolve(event);
  if (event.request.method !== 'GET') error(404, 'Not found');

  const refusal = devLoginRefusal(event);
  if (refusal) {
    event.locals.log.warn('auth.dev_login_refused', { code: 'dev_login_refused', reason: refusal });
    error(404, 'Not found');
  }
  const supabase = event.locals.supabase!;

  if (pathname === DEV_LOGOUT_PATH) {
    await supabase.auth.signOut();
    redirect(303, '/');
  }

  const key = event.url.searchParams.get('as');
  if (!isPersonaKey(key)) error(404, 'Not found');

  const { error: failed } = await supabase.auth.signInWithPassword({
    email: personas[key].email,
    password: PERSONA_PASSWORD,
  });
  if (failed) {
    event.locals.log.warn('auth.dev_login_failed', { code: 'dev_login_failed', reason: key });
    error(503, 'The personas are not in the local Supabase. Run `bun run dev:up`.');
  }

  // Like the login form: where they were going, or the onboarding step first.
  redirect(303, await afterSignIn(event.locals, event.url.searchParams.get('next')));
};
