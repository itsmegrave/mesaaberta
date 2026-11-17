import { initialForm } from '#lib/forms/contract.js';
import { NEW_TOOL_VALUES } from '@mesaaberta/core/tools/schema';
import { requireUser } from '#lib/server/auth/guard.js';
import { handleToolForm } from '#lib/server/tools/form-action.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  return { form: initialForm(NEW_TOOL_VALUES) };
};

export const actions: Actions = {
  default: async (event) => {
    // Who is asking comes before whether we can serve them.
    await requireUser(event.locals, event.url);
    return handleToolForm(event, { done: '/tools?enviado=1' });
  },
};
