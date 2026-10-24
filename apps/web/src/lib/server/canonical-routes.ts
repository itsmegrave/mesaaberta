import type { Handle } from '@sveltejs/kit/hooks';
import { legacyRedirect } from '@mesaaberta/core/routes';

/** Redirect before loading resources; the existing account/admin guards run first. */
export const handleCanonicalRoutes: Handle = ({ event, resolve }) => {
  const target = legacyRedirect(event.url, event.request.method);
  return target
    ? new Response(null, { status: target.status, headers: { location: target.location } })
    : resolve(event);
};
