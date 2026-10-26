import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { validateFormData } from '#lib/forms/contract.js';
import { refuse, responseForm } from '#lib/forms/server.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { withStoredFields, type ProfileSection } from '#lib/profile/sections.js';
import { setAvatarPath, setBannerPath } from '@mesaaberta/core/server/account/service';
import { Invalid } from '@mesaaberta/core/server/errors';
import { AVATAR_BUCKET, prepareImage, storeImage } from '@mesaaberta/core/server/images';
import { isInside, serverStorage } from '@mesaaberta/core/server/storage';
import { loadProfileForm, saveProfile } from '@mesaaberta/core/server/profile/service';
import {
  profileSchema,
  PROFILE_DEFAULTS,
  type ProfileInput,
} from '@mesaaberta/core/profile/schema';
import type { ZodType } from 'zod';

/**
 * Deletes a replaced picture or cover, only ever inside the person's own folder. Best effort: a
 * leftover file is harmless, a failed save is not.
 */
export async function removePicture(locals: App.Locals, userId: string, path: string | null) {
  if (!path || !isInside(path, userId)) return;
  const { error } = (await serverStorage(locals.env, AVATAR_BUCKET)?.remove([path])) ?? {};
  if (error) locals.log.warn('profile picture: could not delete the old file', { error });
}

/**
 * The save of one part of "Editar perfil": what it sent, plus what is stored for the fields it
 * doesn't own (the username always), checked and saved as the whole profile, as before.
 */
export function saveSection(
  section: ProfileSection,
  { hidden }: { hidden?: (locals: App.Locals) => Promise<readonly (keyof ProfileInput)[]> } = {},
) {
  return async ({ request, locals, url }: RequestEvent) => {
    const user = await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');

    const stored = (await loadProfileForm(locals.db, user.id))!;
    const values = withStoredFields(await request.formData(), stored, section, {
      hidden: (await hidden?.(locals)) ?? [],
    });
    const form = validateFormData(values, profileSchema, PROFILE_DEFAULTS, {
      arrays: ['linkNetwork', 'linkUrl'],
      booleans: ['showName'],
    });
    if (!form.valid) return fail(400, { form });

    // Through the api Worker when `api_account` is on for this person; here otherwise.
    const profile = await locals.getProfile();
    const remote = profile
      ? await writeViaApi(locals, 'api_account', profile, '/v1/account/save', form.data)
      : null;
    if (!remote) await saveProfile(locals.db, user.id, form.data);
    return { form };
  };
}

const images = {
  photo: { api: '/v1/account/avatar', set: setAvatarPath, folder: (id: string) => id },
  banner: {
    api: '/v1/account/banner',
    set: setBannerPath,
    folder: (id: string) => `${id}/banners`,
  },
} as const;

/**
 * Points the profile at a stored picture or cover (or at none) and answers the file it replaced,
 * for the caller to delete. Through the api Worker when `api_account` is
 * on for this person.
 */
async function setImage(
  locals: App.Locals,
  userId: string,
  field: keyof typeof images,
  path: string | null,
) {
  const profile = await locals.getProfile();
  const remote = profile
    ? await writeViaApi(locals, 'api_account', profile, images[field].api, { path })
    : null;
  if (remote) return typeof remote.body.replaced === 'string' ? remote.body.replaced : null;
  return images[field].set(locals.db!, userId, path);
}

/**
 * Stores a new profile picture or cover in the person's own folder, points the profile at it and
 * deletes the one it replaced. Answers with a redirect, so the page shows the new image.
 */
export function uploadImage(
  field: keyof typeof images,
  schema: ZodType<Record<string, unknown>>,
  notice: string,
) {
  return async ({ request, locals, url }: RequestEvent) => {
    const user = await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');

    // Files are allowed so the schema can check the picture; every failure below strips them.
    const form = validateFormData(
      await request.formData(),
      schema,
      { [field]: undefined },
      { files: [field] },
    );
    if (!form.valid) return fail(400, { form: responseForm(form) });

    try {
      const prepared = await prepareImage(form.data[field] as File, images[field].folder(user.id));
      const storage = serverStorage(locals.env, AVATAR_BUCKET);
      if (!storage) throw new Invalid('image', 'upload_failed');
      const path = await storeImage(storage, prepared, locals.log);
      await removePicture(locals, user.id, await setImage(locals, user.id, field, path));
    } catch (e) {
      if (e instanceof Invalid) return refuse(form, 400, e.message, field);
      throw e;
    }
    // A fresh request, so the header shows the new picture too.
    redirect(303, `${url.pathname}?${notice}`);
  };
}

/** Takes the uploaded picture or cover off, and deletes its file. */
export function removeImage(field: keyof typeof images, notice: string) {
  return async ({ locals, url }: RequestEvent) => {
    const user = await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');

    await removePicture(locals, user.id, await setImage(locals, user.id, field, null));
    redirect(303, `${url.pathname}?${notice}`);
  };
}
