import { loadRead } from '#lib/server/reads/load.js';
import { followAction } from '#lib/server/follows/action.js';
import { signedInHomeEnabled } from '#lib/server/profile/signed-in-home.js';
import type { Actions, PageServerLoad } from './$types';

// Visitors, and members without `use_signed_in_home`, get the landing page; the others their Início.
export const load: PageServerLoad = async (event) => {
  const profile = await event.locals.getProfile().catch(() => null);
  if (profile && (await signedInHomeEnabled(event.locals, profile)))
    return loadRead(event, 'home');
  return loadRead(event, 'preview');
};

export const actions: Actions = {
  // Seguir next to the people "Você já jogou com" suggests.
  follow: followAction,
};
