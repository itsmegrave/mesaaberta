import { error } from '@sveltejs/kit';
import { can } from '@mesaaberta/core/server/auth/policy';
import { failedEventCount } from '#lib/server/admin/event-queue.js';
import { pendingCount } from '@mesaaberta/core/server/admin/catalog';
import { instagramPosts } from '@mesaaberta/core/server/db/schema';
import { pendingPartnerCount } from '@mesaaberta/core/server/partners/admin';
import { waitingReports } from '@mesaaberta/core/server/moderation/admin';
import { count, eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

// What waits on an admin, for the counts in the navigation. Only admins get this far:
// `handleAdminAccess` answers 404 to anyone else, and the load checks again.
export const load: LayoutServerLoad = async ({ locals }) => {
  if (!can(await locals.getProfile(), 'admin:access')) error(404);
  if (!locals.db) error(503, 'Database not configured');

  const [reports, queue, events, partners, [{ posts }]] = await Promise.all([
    waitingReports(locals.db),
    pendingCount(locals.db),
    failedEventCount(locals.db),
    pendingPartnerCount(locals.db),
    locals.db
      .select({ posts: count() })
      .from(instagramPosts)
      .where(eq(instagramPosts.status, 'uncertain')),
  ]);
  return { adminCounts: { reports, queue, connections: posts, events, partners } };
};
