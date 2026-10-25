import type { AnyDb } from '../db/client';
import { can, type Actor } from '../auth/policy';
import { loadManage } from '../tables/manage';
import { instantToLocal, nextWeeklySession, weeklyInterval } from '../tables/schedule';

function nextSessionOf(
  table: { recurrence: string | null; startsAt: Date; timezone: string },
  now: Date,
): string | null {
  const interval = weeklyInterval(table.recurrence);
  return interval
    ? instantToLocal(
        nextWeeklySession(table.startsAt, interval, table.timezone, now),
        table.timezone,
      )
    : null;
}

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
    canEnd: can(actor, 'table:end', { gmId }),
    // A campaign or adventure that goes on: the GM may end it, or let players rate meanwhile.
    canFinish: can(actor, 'table:finish', {
      gmId,
      tableStatus: manage.table.status,
      kind: manage.table.kind,
    }),
    // A weekly campaign's next date after this session, in the table's zone, to prefill the answer.
    nextSession: nextSessionOf(manage.table, now),
    canInvite: actor?.id === gmId,
    canEdit: can(actor, 'table:edit', { gmId, tableStatus: manage.table.status }),
    systemWaiting: manage.systemWaiting,
    gm: manage.gm,
    gmRating: manage.gmRating,
    requests: manage.requests,
    players: manage.players,
    activity: manage.activity,
  };
}
