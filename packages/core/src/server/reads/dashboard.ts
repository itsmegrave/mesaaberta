import type { AnyDb } from '../db/client';
import { pageNumber } from '../../admin/catalog';
import { listPlaying, listRunning } from '../dashboard/queries';
import { isTableOver } from '../../tables/status-values';

/** How many tables each list shows per page. */
export const DASHBOARD_PAGE_SIZE = 10;

/**
 * Every table this person plays in and every table they run. The tables still on come a page at a
 * time: both lists share the page number, page N is the Nth slice of each, and null means the
 * page is past the longer list's last (the caller answers a 404). The tables that are over
 * (concluded, not held, disabled) come whole in `ended`, for the folded "Encerradas" section. The banner about requests counts
 * them across all of the person's tables. Shared by web's in-process reader and the api's
 * `GET /v1/reads/dashboard`.
 */
export async function readDashboard(
  db: AnyDb,
  personId: string,
  rawPage: string | null,
  now: Date,
) {
  const [allPlaying, allRunning] = await Promise.all([
    listPlaying(db, personId, now),
    listRunning(db, personId, now),
  ]);
  const on = <T extends { tableStatus: Parameters<typeof isTableOver>[0] }>(items: T[]) =>
    items.filter((item) => !isTableOver(item.tableStatus));
  const over = <T extends { tableStatus: Parameters<typeof isTableOver>[0] }>(items: T[]) =>
    items.filter((item) => isTableOver(item.tableStatus));
  const playing = on(allPlaying);
  const running = on(allRunning);

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
    // The tables still on; `ended` holds the rest.
    totals: { playing: playing.length, running: running.length },
    ended: { playing: over(allPlaying), running: over(allRunning) },
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
