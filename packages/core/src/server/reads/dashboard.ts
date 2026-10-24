import type { AnyDb } from '../db/client';
import { pageNumber } from '../../admin/catalog';
import { listPlaying, listRunning } from '../dashboard/queries';

/** How many tables each list shows per page. */
export const DASHBOARD_PAGE_SIZE = 10;

/**
 * Every table this person plays in and every table they run, whatever its status, a page at a
 * time. Both lists share the page number: page N is the Nth slice of each, and null means the
 * page is past the longer list's last (the caller answers a 404). The banner about requests counts
 * them across all of the person's tables. Shared by web's in-process reader and the api's
 * `GET /v1/reads/dashboard`.
 */
export async function readDashboard(
  db: AnyDb,
  personId: string,
  rawPage: string | null,
  now: Date,
) {
  const [playing, running] = await Promise.all([
    listPlaying(db, personId, now),
    listRunning(db, personId, now),
  ]);

  const page = pageNumber(rawPage);
  const pages = Math.max(
    1,
    Math.ceil(playing.length / DASHBOARD_PAGE_SIZE),
    Math.ceil(running.length / DASHBOARD_PAGE_SIZE),
  );
  if (page > pages) return null;
  const slice = <T>(items: T[]) =>
    items.slice((page - 1) * DASHBOARD_PAGE_SIZE, page * DASHBOARD_PAGE_SIZE);

  const waitingIndex = running.findIndex((table) => table.requests.length > 0);
  const waitingTables = running.filter((table) => table.requests.length > 0);
  return {
    playing: slice(playing),
    running: slice(running),
    totals: { playing: playing.length, running: running.length },
    page,
    pages,
    waiting:
      waitingIndex === -1
        ? null
        : {
            requests: waitingTables.reduce((sum, table) => sum + table.requests.length, 0),
            tables: waitingTables.length,
            // The first table with requests, and the page it is on, for the banner's link.
            first: {
              slug: running[waitingIndex].slug,
              title: running[waitingIndex].title,
              page: Math.floor(waitingIndex / DASHBOARD_PAGE_SIZE) + 1,
            },
          },
  };
}
