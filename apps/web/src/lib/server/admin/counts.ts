import { failedEventCount } from '#lib/server/admin/event-queue.js';
import type { AdminCounts } from '#lib/admin/sections.js';
import { pendingCount } from '@mesaaberta/core/server/admin/catalog';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { extensions } from '@mesaaberta/core/server/extensions/index';
import { pendingPartnerCount } from '@mesaaberta/core/server/partners/admin';
import { waitingReports } from '@mesaaberta/core/server/moderation/admin';

/**
 * What waits on an admin, counted beside the sections: the admin layout reads it on each load and
 * `/api/admin/counts` for the page to poll. Callers check the admin first.
 */
export async function adminCounts(db: AnyDb): Promise<AdminCounts> {
  const [reports, queue, events, partners, connections] = await Promise.all([
    waitingReports(db),
    pendingCount(db),
    failedEventCount(db),
    pendingPartnerCount(db),
    // What waits on an admin in each extension's connection, such as an Instagram post to reconcile.
    Promise.all(
      extensions.map(({ admin }) => (admin && !admin.section ? admin.count(db) : 0)),
    ).then((counts) => counts.reduce((total, waiting) => total + waiting, 0)),
  ]);
  return { reports, queue, connections, events, partners };
}
