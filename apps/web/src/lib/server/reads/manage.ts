import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { can } from '@mesaaberta/core/server/auth/policy';
import { Forbidden, NotFound } from '@mesaaberta/core/server/errors';
import { imageUrl, pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { loadManage } from '@mesaaberta/core/server/tables/manage';
import type { RequestEvent } from '@sveltejs/kit';

// The GM's page for one table: requests, players, recent activity. Approving, declining and removing
// post to the table page's own actions (see ActionForm), which send the browser back here.
export const read = async ({ locals, url, params }: RequestEvent) => {
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  try {
    const profile = await locals.getProfile();
    const manage = await loadManage(locals.db, profile, params.slug!, new Date());
    const supabaseUrl = supabaseUrlOf(locals.env);
    const withPicture = <T extends { avatarUrl: string | null; avatarPath: string | null }>({
      avatarUrl,
      avatarPath,
      ...rest
    }: T) => ({ ...rest, avatarUrl: pictureOf(supabaseUrl, { avatarUrl, avatarPath }) });

    // The GM's id stays on the server; the page only needs names and pictures.
    const { gmId, id, imagePath, ...table } = manage.table;
    return {
      table: { ...table, imageUrl: imageUrl(supabaseUrl, imagePath) },
      // A concluded table is frozen (its ratings describe it as it was): no edit link to a 403.
      canDuplicate: manage.canDuplicate,
      canEnd: can(profile, 'table:end', { gmId }),
      canEdit: can(profile, 'table:edit', { gmId, tableStatus: manage.table.status }),
      systemWaiting: manage.systemWaiting,
      gm: withPicture(manage.gm),
      gmRating: manage.gmRating,
      requests: manage.requests.map(withPicture),
      players: manage.players.map(withPicture),
      activity: manage.activity,
    };
  } catch (e) {
    if (e instanceof Forbidden) error(403, 'Forbidden');
    if (e instanceof NotFound) error(404, 'Not found');
    throw e;
  }
};
