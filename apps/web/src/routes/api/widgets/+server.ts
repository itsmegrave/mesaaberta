import { error } from '@sveltejs/kit';
import { showsWidgets } from '#lib/extensions/widget-routes.js';
import type { WidgetsResponse } from '#lib/query/widgets.js';
import { widgetsFor } from '#lib/server/widgets.js';
import { takeSignedIn } from '#lib/server/auth/signed-in-marker.js';
import type { RequestHandler } from './$types';

/**
 * The widgets the signed-in person may see on the page with this route id (`?route=/t/[slug]`),
 * read by the page after it loads. Private to them, and empty wherever widgets never show. The
 * first such page after a sign-in asks with `signedIn`, so a popup that opens on sign-in shows there.
 */
export const GET: RequestHandler = async ({ locals, url, cookies }) => {
  if (!(await locals.getUser())) error(401, 'Sign in required');

  const routeId = url.searchParams.get('route');
  const profile = showsWidgets(routeId) ? await locals.getProfile() : null;
  // The first page since signing in that may show widgets reads the mark (and clears it).
  const widgets: WidgetsResponse['widgets'] = profile
    ? await widgetsFor(locals, profile.id, routeId!, { signedIn: takeSignedIn(cookies) })
    : [];

  return Response.json({ widgets } satisfies WidgetsResponse, {
    headers: { 'cache-control': 'private, no-store' },
  });
};
