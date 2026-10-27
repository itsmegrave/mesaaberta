import { error, type RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { can } from '@mesaaberta/core/server/auth/policy';
import { adminSectionOf, recordAdminEntry } from '@mesaaberta/core/server/admin/entries';
import { dispatchEvent } from '@mesaaberta/core/server/events/dispatcher';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';

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
 * anyone but an active admin, so the area does not even show it exists. Answers the admin.
 */
export async function requireAdmin(locals: App.Locals) {
  const profile = await locals.getProfile().catch(() => null);
  if (!profile || !can(profile, 'admin:access')) error(404, 'Not found');
  return profile;
}

/**
 * Records, after the response, that an admin opened a section of the area: a page or its data on
 * a client navigation, never an action or an endpoint. `recordAdminEntry` keeps it to one entry per
 * section in half an hour. A failure is logged and never reaches the admin.
 */
async function noteEntry(event: RequestEvent) {
  const { locals, route, request } = event;
  if (request.method !== 'GET' || !route.id) return;
  if (!event.isDataRequest && !request.headers.get('accept')?.includes('text/html')) return;
  const profile = await locals.getProfile().catch(() => null);
  if (!profile) return;
  const section = adminSectionOf(route.id);
  locals.afterResponse(async (db) => {
    try {
      const eventId = await recordAdminEntry(db, { actorId: profile.id, section });
      if (eventId)
        await dispatchEvent(db, handlersFor(locals.env), eventId, new Date(), locals.log);
    } catch (error) {
      locals.log.warn('admin entry not recorded', { error, section });
    }
  });
}

/** Hide the entire admin surface, including data requests and actions, from non-admins. */
export const handleAdminAccess: Handle = async ({ event, resolve }) => {
  if (!isAdminRequest(event)) return resolve(event);
  await requireAdmin(event.locals);
  await noteEntry(event);
  return resolve(event);
};
