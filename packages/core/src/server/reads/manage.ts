import type { AnyDb } from '../db/client';
import { can, type Actor } from '../auth/policy';
import { loadManage } from '../tables/manage';

/**
 * The GM's page for one table: requests, players, recent activity. Throws `NotFound` for a table
 * that is not there and `Forbidden` for anyone but its GM or an admin (the caller answers 404 and
 * 403). `gmId` and the table id stay on the server, and the pictures are still storage paths or
 * provider URLs: the caller turns them into URLs with its own Supabase settings. Shared by web's
 * in-process reader and the api's `GET /v1/reads/manage/:slug`.
 */
export async function readManage(db: AnyDb, actor: Actor | null, slug: string, now: Date) {
  const manage = await loadManage(db, actor, slug, now);
  const { gmId, id, ...table } = manage.table;
  return {
    table,
    // A concluded table is frozen (its ratings describe it as it was): no edit link to a 403.
    canDuplicate: manage.canDuplicate,
    canEdit: can(actor, 'table:edit', { gmId, tableStatus: manage.table.status }),
    systemWaiting: manage.systemWaiting,
    gm: manage.gm,
    gmRating: manage.gmRating,
    requests: manage.requests,
    players: manage.players,
    activity: manage.activity,
  };
}
