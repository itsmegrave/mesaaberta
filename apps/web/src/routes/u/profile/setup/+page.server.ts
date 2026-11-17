import { fail, redirect } from '@sveltejs/kit';
import { initialForm, validateFormData } from '#lib/forms/contract.js';
import { refuse } from '#lib/forms/server.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import { Invalid } from '@mesaaberta/core/server/errors';
import {
  ensureProfileViaApi,
  readProfileForm,
  usernameAvailable,
} from '#lib/server/profile/api.js';
import { profileSchema, PROFILE_DEFAULTS } from '@mesaaberta/core/profile/schema';
import { suggestUsername } from '@mesaaberta/core/profile/username';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  // The one authenticated page an incomplete profile may reach.
  const user = await requireUser(locals, url, { allowIncomplete: true });

  const next = safeNext(url.searchParams.get('next'));
  // Also covers someone who signed in before profiles existed: there is nothing to finish without one.
  const profile = await ensureProfileViaApi(locals);
  if (profile.username) redirect(303, next);
  locals.track('gm_onboarding_started', user.id, {
    gm_user_id: user.id,
    onboarding_step: 'profile_setup',
    country_market: 'BR',
  });

  const values = await readProfileForm(locals, user.id);
  // The name from the sign-in provider suggests a username, unless somebody already has it.
  const suggestion = suggestUsername(values.name);
  if (suggestion && (await usernameAvailable(locals, user.id, suggestion)))
    values.username = suggestion;

  return { form: initialForm(values), next };
};

export const actions: Actions = {
  default: async ({ request, locals, url }) => {
    await requireUser(locals, url, { allowIncomplete: true });

    const form = validateFormData(await request.formData(), profileSchema, PROFILE_DEFAULTS, {
      arrays: ['linkNetwork', 'linkUrl'],
    });
    if (!form.valid) return fail(400, { form });

    try {
      // The row is made here (it needs the Auth user's metadata), so the api can see the person.
      const profile = await ensureProfileViaApi(locals);
      await writeViaApi(locals, profile, '/v1/account/onboard', form.data);
    } catch (e) {
      // The unique index decided: somebody took the name after the availability check.
      if (e instanceof Invalid && e.field === 'username') {
        return refuse(form, 400, 'taken', 'username');
      }
      throw e;
    }

    redirect(303, safeNext(url.searchParams.get('next')));
  },
};
