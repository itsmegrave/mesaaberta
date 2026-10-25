import { error } from '@sveltejs/kit';
import { initialForm } from '#lib/forms/contract.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { saveSection } from '#lib/server/profile/edit.js';
import { loadProfileForm } from '@mesaaberta/core/server/profile/service';
import type { Actions, PageServerLoad } from './$types';

// "Sobre você": age range, gender, city and timezone. None of it is on the public profile.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  return { form: initialForm((await loadProfileForm(locals.db, user.id))!) };
};

export const actions: Actions = { save: saveSection('about') };
