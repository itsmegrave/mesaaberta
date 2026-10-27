import { pendingCount } from './catalog';
import { failedEventCount } from './event-queue';
import type { AnyDb } from '../db/client';
import { extensions as installed, type Extension } from '../extensions/index';
import { pendingPartnerCount } from '../partners/admin';
import { hiddenPlaceCount, pendingPlaceCount } from '../places/admin';
import { pendingClaimCount } from '../places/claims';
import { waitingReports } from '../moderation/admin';

/** What waits on an admin, counted beside each section of the admin pages. */
export type AdminCounts = {
  reports: number;
  queue: number;
  connections: number;
  events: number;
  partners: number;
  places: number;
  /** Places reports hid: the admins' high alert, counted in red beside "Lugares". */
  hiddenPlaces: number;
};

/**
 * What waits on an admin, counted beside the sections: the admin layout reads it on each load and
 * `/api/admin/counts` for the page to poll. Callers check the admin first.
 */
export async function adminCounts(
  db: AnyDb,
  extensions: readonly Extension[] = installed,
): Promise<AdminCounts> {
  const [reports, queue, events, partners, places, claims, hiddenPlaces, connections] =
    await Promise.all([
      waitingReports(db),
      pendingCount(db),
      failedEventCount(db),
      pendingPartnerCount(db),
      pendingPlaceCount(db),
      // A claim waits in the same queue: "Lugares" counts both.
      pendingClaimCount(db),
      hiddenPlaceCount(db),
      // What waits on an admin in each extension's connection, such as an Instagram post to reconcile.
      Promise.all(
        extensions.map(({ admin }) => (admin && !admin.section ? admin.count(db) : 0)),
      ).then((counts) => counts.reduce((total, waiting) => total + waiting, 0)),
    ]);
  return { reports, queue, connections, events, partners, places: places + claims, hiddenPlaces };
}
