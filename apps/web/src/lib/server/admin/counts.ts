import { failedEventCount } from '#lib/server/admin/event-queue.js';
import type { AdminCounts } from '#lib/admin/sections.js';
import { pendingCount } from '@mesaaberta/core/server/admin/catalog';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { instagramPosts } from '@mesaaberta/core/server/db/schema';
import { pendingPartnerCount } from '@mesaaberta/core/server/partners/admin';
import { waitingReports } from '@mesaaberta/core/server/moderation/admin';
import { count, eq } from 'drizzle-orm';

/**
 * What waits on an admin, counted beside the sections: the admin layout reads it on each load and
 * `/api/admin/counts` for the page to poll. Callers check the admin first.
 */
export async function adminCounts(db: AnyDb): Promise<AdminCounts> {
  const [reports, queue, events, partners, [{ posts }]] = await Promise.all([
    waitingReports(db),
    pendingCount(db),
    failedEventCount(db),
    pendingPartnerCount(db),
    db
      .select({ posts: count() })
      .from(instagramPosts)
      .where(eq(instagramPosts.status, 'uncertain')),
  ]);
  return { reports, queue, connections: posts, events, partners };
}
