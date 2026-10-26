import type { AnyDb } from '../db/client';
import { listNewTables, listUpcomingTables } from '../tables/queries';

// Each carousel on the home page shows up to this many tables; the full list lives at /t.
export const PREVIEW_COUNT = 10;

/**
 * The home page carousels: the next upcoming tables (Mesas abertas) and the ones published most
 * recently (Novas mesas). A table can be in both. `gmId` stays on the server (the page only needs
 * the GM's name) and the picture is still a storage path: the caller turns it into a URL with its
 * own Supabase settings. Shared by web's in-process reader and the api's `GET /v1/reads/preview`.
 */
export async function readPreview(db: AnyDb, now: Date) {
  const [upcoming, fresh] = await Promise.all([
    listUpcomingTables(db, now),
    listNewTables(db, now, PREVIEW_COUNT),
  ]);
  const publicView = ({ gmId, ...table }: (typeof upcoming)[number]) => table;
  return {
    tables: upcoming.slice(0, PREVIEW_COUNT).map(publicView),
    newTables: fresh.map(publicView),
  };
}
