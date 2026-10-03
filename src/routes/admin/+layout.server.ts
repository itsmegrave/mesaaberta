import { error } from '@sveltejs/kit';
import { can } from '$lib/server/auth/policy';
import { pendingCount } from '$lib/server/admin/catalog';
import { instagramPosts } from '$lib/server/db/schema';
import { waitingReports } from '$lib/server/moderation/admin';
import { count, eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

// What waits on an admin, for the counts in the navigation. Only admins get this far:
// `handleAdminAccess` answers 404 to anyone else, and the load checks again.
export const load: LayoutServerLoad = async ({ locals, setHeaders }) => {
  if (!can(await locals.getProfile(), 'admin:access')) error(404);
  if (!locals.db) error(503, 'Database not configured');
  setHeaders({ 'cache-control': 'private, no-store' });

  const [reports, queue, [{ posts }]] = await Promise.all([
    waitingReports(locals.db),
    pendingCount(locals.db),
    locals.db
      .select({ posts: count() })
      .from(instagramPosts)
      .where(eq(instagramPosts.status, 'uncertain')),
  ]);
  return { adminCounts: { reports, queue, connections: posts } };
};
