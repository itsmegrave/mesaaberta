import type { AnyDb } from '../db/client';
import { listUpcomingTables } from '../tables/queries';

// The home page previews the next few tables; the full list lives at /tables.
const PREVIEW_COUNT = 3;

/**
 * The next few upcoming tables for the home page. `gmId` stays on the server (the page only needs
 * the GM's name) and the picture is still a storage path: the caller turns it into a URL with its
 * own Supabase settings. Shared by web's in-process reader and the api's `GET /v1/reads/preview`.
 */
export async function readPreview(db: AnyDb, now: Date) {
  const tables = await listUpcomingTables(db, now);
  return {
    tables: tables.slice(0, PREVIEW_COUNT).map(({ gmId, ...table }) => table),
  };
}
