import { error } from '@sveltejs/kit';
import { initialForm } from '#lib/forms/contract.js';
import { NEW_PLACE_VALUES } from '@mesaaberta/core/places/schema';
import { requireUser } from '#lib/server/auth/guard.js';
import { requireDirectory } from '#lib/server/directories/flags.js';
import { handlePlaceForm } from '#lib/server/places/form-action.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  await requireDirectory(locals, 'places');
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  return { form: initialForm(NEW_PLACE_VALUES) };
};

export const actions: Actions = {
  default: async (event) => {
    await requireDirectory(event.locals, 'places');
    // Who is asking comes before whether we can serve them.
    await requireUser(event.locals, event.url);
    return handlePlaceForm(event);
  },
};
