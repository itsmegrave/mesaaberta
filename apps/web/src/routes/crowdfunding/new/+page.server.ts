import {
  NEW_CROWDFUNDING_VALUES,
  handleCrowdfundingForm,
} from '#lib/server/crowdfunding/form-action.js';
import { initialForm } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  return { form: initialForm(NEW_CROWDFUNDING_VALUES) };
};

export const actions: Actions = {
  default: async (event) => {
    // Who is asking comes before whether we can serve them.
    await requireUser(event.locals, event.url);
    return handleCrowdfundingForm(event);
  },
};
