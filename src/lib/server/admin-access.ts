import { error, type Handle } from '@sveltejs/kit';
import { can } from '$lib/server/auth/policy';

export const isAdminPath = (pathname: string) =>
  pathname === '/admin' || pathname.startsWith('/admin/');

/** Hide the entire admin surface, including data requests and actions, from non-admins. */
export const handleAdminAccess: Handle = async ({ event, resolve }) => {
  if (!isAdminPath(event.url.pathname)) return resolve(event);

  let allowed = false;
  try {
    allowed = can(await event.locals.getProfile(), 'admin:access');
  } catch {
    // A profile lookup failure must not make admin routes available.
  }

  if (!allowed) error(404, 'Not found');

  return resolve(event);
};
