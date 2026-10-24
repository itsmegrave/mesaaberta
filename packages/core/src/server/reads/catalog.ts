import type { AnyDb } from '../db/client';
import { listCatalog } from '../catalog';
import { listSystems } from '../systems';

/**
 * What the new-table and edit forms offer: the approved systems, platforms and tags, plus the ones
 * `suggestedBy` proposed and are still waiting. Shared by web's in-process reader and the api's
 * `GET /v1/reads/catalog`, so both answer with the same JSON.
 */
export async function readCatalog(db: AnyDb, suggestedBy?: string) {
  const [systems, catalog] = await Promise.all([
    listSystems(db, { suggestedBy }),
    listCatalog(db, { suggestedBy }),
  ]);
  return { systems, catalog };
}
