import { error, redirect } from '@sveltejs/kit';
import { initialForm, validateStringForm } from '#lib/forms/contract.js';
import { refuse } from '#lib/forms/server.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { removePicture } from '#lib/server/profile/edit.js';
import { deleteAccountSchema } from '#lib/profile/delete.js';
import { Invalid } from '@mesaaberta/core/server/errors';
import { loadProfileForm } from '@mesaaberta/core/server/profile/service';
import type { Actions, PageServerLoad } from './$types';

// "Privacidade e dados": what others see, a copy of the account's data, and closing the account.
export const load: PageServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  return { deleteForm: initialForm({ confirm: '' }) };
};

export const actions: Actions = {
  // Closes the account: the database first (tables disabled, seats and ratings gone), then the
  // calendar cancellations, then the profile is emptied and the Auth user deleted.
  delete: async ({ request, locals, url }) => {
    const user = await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');

    const username = (await loadProfileForm(locals.db, user.id))!.username;
    const form = validateStringForm(await request.formData(), deleteAccountSchema, ['confirm']);
    if (!form.valid || form.data.confirm !== username)
      return refuse(form, 400, 'confirm', 'confirm');

    // The picture and the cover go first, while the profile still says which files are theirs.
    const profile = await locals.getProfile();
    await removePicture(locals, user.id, profile?.avatarPath ?? null);
    await removePicture(locals, user.id, profile?.bannerPath ?? null);
    // The api Worker deletes the account, its data and its Auth user.
    try {
      await writeViaApi(locals, user, '/v1/account/delete', { confirm: form.data.confirm });
    } catch (e) {
      if (e instanceof Invalid) return refuse(form, 400, 'confirm', 'confirm');
      throw e;
    }
    await locals.supabase?.auth.signOut();

    redirect(303, '/');
  },
};
