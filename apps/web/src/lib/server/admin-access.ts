import { error, type Handle, type RequestEvent } from '@sveltejs/kit';
import { can } from '$lib/server/auth/policy';

export const isAdminPath = (pathname: string) =>
  pathname === '/admin' || pathname.startsWith('/admin/');

/**
 * Whether a request reaches the admin area. The matched route decides, not only the raw path: an
 * encoded path (`/%61dmin`) or a localized one (`/en/admin`) still lands on an `/admin` route.
 */
export function isAdminRequest(event: Pick<RequestEvent, 'url' | 'route'>) {
  if (event.route?.id && isAdminPath(event.route.id)) return true;
  let pathname = event.url.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // A malformed path matches no route; the raw one is checked below.
  }
  return isAdminPath(pathname.toLowerCase()) || isAdminPath(event.url.pathname);
}

/** Whether the signed-in person is an active admin. A failed lookup is a no. */
export async function isAdmin(locals: App.Locals) {
  try {
    return can(await locals.getProfile(), 'admin:access');
  } catch {
    return false;
  }
}

/**
 * Call at the top of every admin `load`, action and endpoint, besides the hook below: 404 for
 * anyone but an active admin, so the area does not even show it exists.
 */
export async function requireAdmin(locals: App.Locals) {
  if (!(await isAdmin(locals))) error(404, 'Not found');
}

/** Hide the entire admin surface, including data requests and actions, from non-admins. */
export const handleAdminAccess: Handle = async ({ event, resolve }) => {
  if (!isAdminRequest(event)) return resolve(event);
  await requireAdmin(event.locals);
  return resolve(event);
};
