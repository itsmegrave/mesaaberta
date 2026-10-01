import { error } from '@sveltejs/kit';
import { pageNumber } from '$lib/admin/catalog';
import { requireUser } from '$lib/server/auth/guard';
import { listPlaying, listRunning } from '$lib/server/dashboard/queries';
import type { RequestEvent } from '@sveltejs/kit';

/** How many tables each list shows per page. */
export const DASHBOARD_PAGE_SIZE = 10;

/**
 * Every table I play in and every table I run, whatever its status, a page at a time. Both lists
 * share `?page=N`: page N is the Nth slice of each, and the page past the longer list's last is a
 * 404. The banner about requests counts them across all of my tables.
 */
export const read = async ({ locals, url }: RequestEvent) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  const now = new Date();
  const [playing, running] = await Promise.all([
    listPlaying(locals.db, user.id, now),
    listRunning(locals.db, user.id, now),
  ]);

  const page = pageNumber(url.searchParams.get('page'));
  const pages = Math.max(
    1,
    Math.ceil(playing.length / DASHBOARD_PAGE_SIZE),
    Math.ceil(running.length / DASHBOARD_PAGE_SIZE),
  );
  if (page > pages) error(404, 'Not found');
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
};
