import type { AdminCounts } from '#lib/admin/sections.js';
import { readFromApi } from '../api-read';

/**
 * What waits on an admin, counted beside the sections, from the api Worker: the admin layout reads
 * it on each load and `/api/admin/counts` for the page to poll. Callers check the admin first.
 */
export function adminCounts(locals: App.Locals, actorId: string): Promise<AdminCounts> {
  return readFromApi<AdminCounts>(locals, actorId, '/v1/admin-reads/counts');
}
