import { fail } from '@sveltejs/kit';
import { initialForm, validateFormData } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { readFromApi } from '#lib/server/api-read.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { requireAvailability } from '#lib/server/profile/availability.js';
import { availabilitySchema, type AvailabilitySlot } from '@mesaaberta/core/profile/availability';
import type { Actions, PageServerLoad } from './$types';

// "Quando posso jogar": the days and parts of the day the person can usually play, shown on their
// profile and on Procuro mesa.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  await requireAvailability(locals, user.id);
  const { slots } = await readFromApi<{ slots: AvailabilitySlot[] }>(
    locals,
    user.id,
    '/v1/me/availability',
  );
  return { form: initialForm({ slots }) };
};

export const actions: Actions = {
  save: async ({ locals, request, url }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    await requireAvailability(locals, user.id);
    const form = validateFormData(
      await request.formData(),
      availabilitySchema,
      { slots: [] },
      { arrays: ['slots'] },
    );
    if (!form.valid) return fail(400, { form });
    await writeViaApi(locals, user, '/v1/me/availability', form.data);
    return { form };
  },
};
