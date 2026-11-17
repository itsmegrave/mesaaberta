import { initialForm } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { saveSection } from '#lib/server/profile/edit.js';
import { readProfileForm } from '#lib/server/profile/api.js';
import type { Actions, PageServerLoad } from './$types';

// "Sobre você": age range, gender, city and timezone. None of it is on the public profile.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  return { form: initialForm(await readProfileForm(locals, user.id)) };
};

export const actions: Actions = { save: saveSection('about') };
