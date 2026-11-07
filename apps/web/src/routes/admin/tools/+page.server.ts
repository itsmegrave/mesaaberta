import { requireAdmin } from '#lib/server/admin-access.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { supabaseUrlOf, toolLogoUrl } from '@mesaaberta/core/server/images';
import { toolActions } from '#lib/server/moderation/admin-actions.js';
import type { AdminTools } from '@mesaaberta/core/server/tools/service';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';

import type { Actions, PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and the load checks again.
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  const user = await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });

  const list = revivedDates(
    await readFromApi<AdminTools>(locals, user.id, `/v1/admin-reads/tools?${url.searchParams}`),
  );
  const supabase = supabaseUrlOf(locals.env);
  return {
    tools: {
      ...list,
      rows: list.rows.map(({ logoPath, ...row }) => ({
        ...row,
        logo: toolLogoUrl(supabase, logoPath),
      })),
    },
  };
};

export const actions: Actions = {
  approve: toolActions.approve,
  remove: toolActions.remove,
};
