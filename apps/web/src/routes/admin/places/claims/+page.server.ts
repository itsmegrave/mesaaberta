import { requireAdmin } from '#lib/server/admin-access.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { placeClaimActions } from '#lib/server/moderation/admin-actions.js';
import type { listClaims } from '@mesaaberta/core/server/places/claims';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';

import type { Actions, PageServerLoad } from './$types';

// "Reivindicações": who asked to manage a place. Only admins get this far (`handleAdminAccess`
// answers 404 to anyone else, and the load checks again).
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  const user = await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });

  // A page past the last is the api's 404, which becomes the page's.
  const claims = revivedDates(
    await readFromApi<NonNullable<Awaited<ReturnType<typeof listClaims>>>>(
      locals,
      user.id,
      `/v1/admin-reads/claims?${url.searchParams}`,
    ),
  );
  return { claims };
};

export const actions: Actions = {
  approve: placeClaimActions.approve,
  reject: placeClaimActions.reject,
};
