import { error } from '@sveltejs/kit';
import { widgetExtensions } from '@mesaaberta/core/server/extensions/index';
import { showsWidgets } from '#lib/extensions/widget-routes.js';
import type { WidgetsResponse } from '#lib/query/widgets.js';
import { widgetViewer } from '#lib/server/widgets.js';
import type { RequestHandler } from './$types';

/**
 * The widgets the signed-in person may see on the page with this route id (`?route=/t/[slug]`),
 * read by the page after it loads. Private to them, and empty wherever widgets never show.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  if (!(await locals.getUser())) error(401, 'Sign in required');
  if (!locals.db) error(503, 'Database not configured');

  const routeId = url.searchParams.get('route');
  const viewer = showsWidgets(routeId) ? await widgetViewer(locals) : null;
  const widgets: WidgetsResponse['widgets'] = [];
  if (viewer)
    for (const extension of widgetExtensions())
      for (const widget of await extension.widgets.forViewer(
        locals.db,
        viewer,
        routeId!,
        locals.flags,
      ))
        widgets.push({ ext: extension.id, widget });

  return Response.json({ widgets } satisfies WidgetsResponse, {
    headers: { 'cache-control': 'private, no-store' },
  });
};
