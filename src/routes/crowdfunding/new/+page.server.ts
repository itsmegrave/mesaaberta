import { error } from '@sveltejs/kit';
import {
  NEW_CROWDFUNDING_VALUES,
  handleCrowdfundingForm,
} from '$lib/server/crowdfunding/form-action';
import { initialForm } from '$lib/forms/contract';
import { requireUser } from '$lib/server/auth/guard';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  return { form: initialForm(NEW_CROWDFUNDING_VALUES) };
};

export const actions: Actions = {
  default: async (event) => {
    // Who is asking comes before whether we can serve them.
    await requireUser(event.locals, event.url);
    return handleCrowdfundingForm(event);
  },
};
