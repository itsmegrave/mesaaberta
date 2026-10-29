import { requireAdmin } from '#lib/server/admin-access.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { placeLinkActions } from '#lib/server/moderation/admin-actions.js';
import type { AdminPartnerLinks } from '@mesaaberta/core/server/places/partner-links';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';

import type { Actions, PageServerLoad } from './$types';

// "Vínculos": places asking to be shown as a partner's. Only admins get this far
// (`handleAdminAccess` answers 404 to anyone else, and the load checks again).
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  const user = await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });

  // A page past the last is the api's 404, which becomes the page's.
  const links = revivedDates(
    await readFromApi<AdminPartnerLinks>(
      locals,
      user.id,
      `/v1/admin-reads/links?${url.searchParams}`,
    ),
  );
  return { links };
};

export const actions: Actions = {
  approve: placeLinkActions.approve,
  reject: placeLinkActions.reject,
};
