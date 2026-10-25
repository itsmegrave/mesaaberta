import { error } from '@sveltejs/kit';
import { can } from '@mesaaberta/core/server/auth/policy';
import { extensions } from '@mesaaberta/core/server/extensions/index';
import { adminCounts } from '#lib/server/admin/counts.js';
import type { LayoutServerLoad } from './$types';

// What waits on an admin, for the counts in the navigation. Only admins get this far:
// `handleAdminAccess` answers 404 to anyone else, and the load checks again. The page then polls
// `/api/admin/counts` so the numbers do not go stale while an admin stays on one page.
export const load: LayoutServerLoad = async ({ locals }) => {
  if (!can(await locals.getProfile(), 'admin:access')) error(404);
  if (!locals.db) error(503, 'Database not configured');

  // The connections page opens on the first installed extension that has a panel on it.
  const panel = extensions.find((extension) => extension.admin);
  return {
    adminCounts: await adminCounts(locals.db),
    adminConnections: panel ? `/admin/${panel.id}` : null,
  };
};
