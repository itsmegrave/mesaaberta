import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { Forbidden, NotFound } from '@mesaaberta/core/server/errors';
import { imageUrl, pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { listTableInvitations } from '#lib/server/invitations/api.js';
import { readManage } from '@mesaaberta/core/server/reads/manage';
import type { RequestEvent } from '@sveltejs/kit';
import { readViaApi } from '../api-read';
import { playerRatingsEnabled } from '../ratings/players';

// The GM's page for one table: requests, players, recent activity. Approving, declining and removing
// post to the table page's own actions (see ActionForm), which send the browser back here. Through
// the api Worker when `api_reads_manage` is on for the signed-in person; here otherwise, which is
// also where a refusal ends in the page's own 403 or 404.
export const read = async ({ locals, url, params }: RequestEvent) => {
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  try {
    const profile = await locals.getProfile();
    const remote = profile
      ? await readViaApi<Awaited<ReturnType<typeof readManage>>>(
          locals,
          'api_reads_manage',
          profile,
          `/v1/reads/manage/${encodeURIComponent(params.slug!)}`,
        )
      : null;
    // JSON turned the dates into strings; the page gets them as dates either way.
    const manage = remote
      ? {
          ...remote,
          table: {
            ...remote.table,
            startsAt: new Date(remote.table.startsAt),
            until: remote.table.until ? new Date(remote.table.until) : null,
          },
          requests: remote.requests.map((row) => ({ ...row, since: new Date(row.since) })),
          players: remote.players.map((row) => ({ ...row, since: new Date(row.since) })),
          activity: remote.activity.map((item) => ({ ...item, at: new Date(item.at) })),
        }
      : await readManage(locals.db, profile, params.slug!, new Date());

    const supabaseUrl = supabaseUrlOf(locals.env);
    const withPicture = <T extends { avatarUrl: string | null; avatarPath: string | null }>({
      avatarUrl,
      avatarPath,
      ...rest
    }: T) => ({ ...rest, avatarUrl: pictureOf(supabaseUrl, { avatarUrl, avatarPath }) });

    const { imagePath, ...table } = manage.table;
    // Off (`use_player_ratings`): no rating card and no score on the requests.
    const ratings = profile ? await playerRatingsEnabled(locals, profile) : false;
    return {
      ...manage,
      playerRatings: ratings,
      canRatePlayers: ratings && manage.canRatePlayers,
      table: { ...table, imageUrl: imageUrl(supabaseUrl, imagePath) },
      invitations: manage.canInvite
        ? await listTableInvitations(locals, profile, params.slug!)
        : [],
      gm: withPicture(manage.gm),
      requests: manage.requests.map(withPicture),
      players: manage.players.map(withPicture),
    };
  } catch (e) {
    if (e instanceof Forbidden) error(403, 'Forbidden');
    if (e instanceof NotFound) error(404, 'Not found');
    throw e;
  }
};
