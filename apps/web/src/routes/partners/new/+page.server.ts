import { error } from '@sveltejs/kit';
import { initialForm } from '$lib/forms/contract';
import { NEW_PARTNER_VALUES } from '$lib/partners/schema';
import { requireUser } from '$lib/server/auth/guard';
import { handlePartnerForm } from '$lib/server/partners/form-action';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  return { form: initialForm(NEW_PARTNER_VALUES) };
};

export const actions: Actions = {
  default: async (event) => {
    // Who is asking comes before whether we can serve them.
    await requireUser(event.locals, event.url);
    return handlePartnerForm(event);
  },
};
