import { initialForm } from '#lib/forms/contract.js';
import { NEW_PARTNER_VALUES } from '@mesaaberta/core/partners/schema';
import { requireUser } from '#lib/server/auth/guard.js';
import { handlePartnerForm } from '#lib/server/partners/form-action.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  return { form: initialForm(NEW_PARTNER_VALUES) };
};

export const actions: Actions = {
  default: async (event) => {
    // Who is asking comes before whether we can serve them.
    await requireUser(event.locals, event.url);
    return handlePartnerForm(event);
  },
};
