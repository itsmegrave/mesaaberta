import type { Handle, RequestEvent } from '@sveltejs/kit';
import { can } from '$lib/server/auth/policy';
import { m } from '$lib/paraglide/messages';

/** Where the maintenance screen lives. Visitors never go there: it is served at the address they asked for. */
export const MAINTENANCE_PATH = '/maintenance';

// Still reachable while the site is down: the uptime check, the screen itself, and the way in for
// an admin (sign-in with a password or a provider, its callback, and signing out). Static files are
// served before the Worker runs; they are listed only in case one ever reaches it.
const exactExempt = new Set([
  '/healthz',
  MAINTENANCE_PATH,
  '/login',
  '/auth/callback',
  '/logout',
  '/robots.txt',
  '/favicon.ico',
  '/site.webmanifest',
]);
const prefixExempt = ['/login/', '/_app/', '/favicon-', '/android-chrome-', '/apple-touch-icon'];

export const isExempt = (pathname: string) =>
  exactExempt.has(pathname) || prefixExempt.some((prefix) => pathname.startsWith(prefix));

// About an hour: a hint for browsers and crawlers, not a promise.
const RETRY_AFTER_SECONDS = '3600';

const blocked = (body: BodyInit | null, headers: HeadersInit) => {
  const response = new Response(body, { status: 503, headers });
  response.headers.set('retry-after', RETRY_AFTER_SECONDS);
  response.headers.set('cache-control', 'no-store');
  response.headers.set('x-robots-tag', 'noindex');
  return response;
};

// An admin passes. If the profile cannot be read, the visitor is treated as anyone else: the
// screen is safer than the site.
const isAdmin = async (event: RequestEvent) => {
  try {
    return can(await event.locals.getProfile(), 'admin:access');
  } catch (error) {
    event.locals.log.error('maintenance: could not read the profile', { error });
    return false;
  }
};

const wantsPage = (event: RequestEvent) =>
  (event.request.method === 'GET' || event.request.method === 'HEAD') &&
  (event.request.headers.get('accept') ?? '').includes('text/html');

/**
 * With the `maintenance_mode` flag on, every request gets the maintenance screen with a 503, except
 * the exempt paths and a signed-in admin, who uses the site as usual (with a banner). A page request
 * gets the screen at the address asked for; anything else (form posts, data and file endpoints) gets
 * the same sentence as plain text. Nothing technical is said.
 */
export const handleMaintenance: Handle = async ({ event, resolve }) => {
  if (!(await event.locals.flags.isEnabled('maintenance_mode'))) return resolve(event);

  if (isExempt(event.url.pathname)) return resolve(event);

  if (await isAdmin(event)) {
    event.locals.maintenance = 'bypass';
    return resolve(event);
  }

  event.locals.maintenance = 'blocked';
  if (wantsPage(event)) {
    // The screen's own headers (its Content-Security-Policy included) go along with it.
    const screen = await event.fetch(MAINTENANCE_PATH, { headers: { accept: 'text/html' } });
    return blocked(event.request.method === 'HEAD' ? null : await screen.text(), screen.headers);
  }

  return blocked(m.maintenance_text(), { 'content-type': 'text/plain; charset=utf-8' });
};
