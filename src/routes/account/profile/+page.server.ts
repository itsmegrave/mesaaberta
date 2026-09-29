import { error, fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { anonymiseProfile, closeAccount, setAvatarPath } from '$lib/server/account/service';
import { deleteAuthUser, supabaseAdminFrom } from '$lib/server/auth/admin-client';
import { requireUser } from '$lib/server/auth/guard';
import { dispatchEvent } from '$lib/server/events/dispatcher';
import { handlersFor } from '$lib/server/events/handlers';
import { Invalid } from '$lib/server/errors';
import {
  AVATAR_BUCKET,
  pictureOf,
  prepareImage,
  storeImage,
  supabaseUrlOf,
} from '$lib/server/images';
import { loadProfileForm, saveProfile } from '$lib/server/profile/service';
import { profileSchema } from '$lib/profile/schema';
import type { Actions, PageServerLoad } from './$types';

/** Deletes a replaced picture. Best effort: a leftover file is harmless, a failed save is not. */
async function removePicture(locals: App.Locals, path: string | null) {
  if (!path) return;
  const { error } = (await locals.supabase?.storage.from(AVATAR_BUCKET).remove([path])) ?? {};
  if (error) locals.log.warn('profile picture: could not delete the old file', { error });
}

export const load: PageServerLoad = async ({ locals, url, platform }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  const values = (await loadProfileForm(locals.db, user.id))!;
  const profile = await locals.getProfile();

  return {
    form: await superValidate(values, zod4(profileSchema), { errors: false }),
    email: user.email ?? '',
    avatarUrl: profile ? pictureOf(supabaseUrlOf(platform?.env), profile) : null,
    hasUploadedPhoto: Boolean(profile?.avatarPath),
    username: values.username,
  };
};

export const actions: Actions = {
  save: async ({ request, locals, url }) => {
    const user = await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');

    const form = await superValidate(request, zod4(profileSchema));
    // The username is chosen once, at onboarding: whatever was sent, the stored one stays.
    const current = (await loadProfileForm(locals.db, user.id))!.username;
    form.data.username = current;
    delete form.errors.username;
    if (Object.keys(form.errors).length > 0) return fail(400, { form });

    await saveProfile(locals.db, user.id, form.data);
    return { form };
  },

  photo: async ({ request, locals, url }) => {
    const user = await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');

    const file = (await request.formData()).get('photo');
    if (!(file instanceof File) || file.size === 0) return fail(400, { photoError: 'empty' });

    try {
      const prepared = await prepareImage(file, user.id);
      const storage = locals.supabase?.storage.from(AVATAR_BUCKET);
      if (!storage) throw new Invalid('image', 'upload_failed');
      const path = await storeImage(storage, prepared, locals.log);
      await removePicture(locals, await setAvatarPath(locals.db, user.id, path));
    } catch (e) {
      if (e instanceof Invalid) return fail(400, { photoError: e.message });
      throw e;
    }
    // A fresh request, so the header shows the new picture too.
    redirect(303, `${url.pathname}?foto=salva`);
  },

  removePhoto: async ({ locals, url }) => {
    const user = await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');

    await removePicture(locals, await setAvatarPath(locals.db, user.id, null));
    redirect(303, `${url.pathname}?foto=removida`);
  },

  // Closes the account: the database first (tables disabled, seats and ratings gone), then the
  // calendar cancellations, then the profile is emptied and the Auth user deleted.
  delete: async (event) => {
    const { request, locals, url, platform } = event;
    const user = await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');

    const admin = supabaseAdminFrom(platform?.env);
    if (!admin) error(503, 'Account deletion is not configured');

    const username = (await loadProfileForm(locals.db, user.id))!.username;
    const typed = String((await request.formData()).get('confirm') ?? '')
      .trim()
      .toLowerCase();
    if (typed !== username) return fail(400, { deleteError: 'confirm' as const });

    const { eventIds } = await closeAccount(locals.db, user.id);
    // Sent now, while the GM's address still exists; a failure is left to the sweeper.
    const handlers = handlersFor(platform?.env);
    for (const id of eventIds) {
      await dispatchEvent(locals.db, handlers, id).catch((e: unknown) =>
        locals.log.error('account deletion: dispatch failed', { error: e, eventId: id }),
      );
    }
    const picture = (await locals.getProfile())?.avatarPath ?? null;
    await removePicture(locals, picture);
    await anonymiseProfile(locals.db, user.id);
    await deleteAuthUser(admin, user.id);
    await locals.supabase?.auth.signOut();
    locals.log.info('account deleted', { tables: eventIds.length });

    redirect(303, '/');
  },
};
