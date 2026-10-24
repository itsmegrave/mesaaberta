import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin-access.js';
import { adminCounts } from '#lib/server/admin/counts.js';
import type { RequestHandler } from './$types';

/**
 * The counts beside the admin's sections, for the admin pages to poll. The path is outside
 * `/admin`, so the admin hook does not cover it: the endpoint checks itself, with the same 404.
 */
export const GET: RequestHandler = async ({ locals }) => {
  await requireAdmin(locals);
  if (!locals.db) error(503, 'Database not configured');

  return Response.json(await adminCounts(locals.db), {
    headers: { 'cache-control': 'private, no-store' },
  });
};
