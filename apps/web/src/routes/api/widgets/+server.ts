import { error } from '@sveltejs/kit';
import { showsWidgets } from '#lib/extensions/widget-routes.js';
import type { WidgetsResponse } from '#lib/query/widgets.js';
import { widgetsFor } from '#lib/server/widgets.js';
import type { RequestHandler } from './$types';

/**
 * The widgets the signed-in person may see on the page with this route id (`?route=/t/[slug]`),
 * read by the page after it loads. Private to them, and empty wherever widgets never show.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  if (!(await locals.getUser())) error(401, 'Sign in required');

  const routeId = url.searchParams.get('route');
  const profile = showsWidgets(routeId) ? await locals.getProfile() : null;
  const widgets: WidgetsResponse['widgets'] = profile
    ? await widgetsFor(locals, profile.id, routeId!)
    : [];

  return Response.json({ widgets } satisfies WidgetsResponse, {
    headers: { 'cache-control': 'private, no-store' },
  });
};
