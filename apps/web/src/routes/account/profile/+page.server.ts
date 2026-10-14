import { error, fail, redirect } from '@sveltejs/kit';
import { initialForm, validateFormData, validateStringForm } from '$lib/forms/contract';
import { refuse, responseForm, withoutSecrets } from '$lib/forms/server';
import { setAvatarPath } from '@mesaaberta/core/server/account/service';
import { deleteAccount } from '@mesaaberta/core/server/account/delete';
import { supabaseAdminFrom } from '@mesaaberta/core/server/auth/admin-client';
import { requireUser } from '$lib/server/auth/guard';
import { writeViaApi } from '$lib/server/api-write';
import { connections, unlink } from '@mesaaberta/core/server/auth/identities';
import { handlersFor } from '@mesaaberta/core/server/events/handlers';
import { Forbidden, Invalid, NotFound, RateLimited } from '@mesaaberta/core/server/errors';
import { can } from '@mesaaberta/core/server/auth/policy';
import { addPasswordFormSchema } from '@mesaaberta/core/auth/password-setup';
import {
  AVATAR_BUCKET,
  pictureOf,
  prepareImage,
  storeImage,
  supabaseUrlOf,
} from '@mesaaberta/core/server/images';
import { loadProfileForm, saveProfile } from '@mesaaberta/core/server/profile/service';
import { directMessagesSchema } from '@mesaaberta/core/messages/schema';
import { setDirectMessages } from '@mesaaberta/core/server/messages/service';
import { deleteAccountSchema } from '$lib/profile/delete';
import { disconnectSchema } from '$lib/profile/connections';
import { photoSchema } from '$lib/profile/photo';
import { profileSchema, PROFILE_DEFAULTS } from '@mesaaberta/core/profile/schema';
import type { Actions, PageServerLoad } from './$types';

/** Deletes a replaced picture. Best effort: a leftover file is harmless, a failed save is not. */
async function removePicture(locals: App.Locals, path: string | null) {
  if (!path) return;
  const { error } = (await locals.supabase?.storage.from(AVATAR_BUCKET).remove([path])) ?? {};
  if (error) locals.log.warn('profile picture: could not delete the old file', { error });
}

/** The "create a password" card exists only where `api_password` is on: the api does the work. */
const passwordOffered = async (
  locals: App.Locals,
  profile: Awaited<ReturnType<App.Locals['getProfile']>>,
) =>
  profile
    ? locals.flags.isEnabled('api_password', {
        id: profile.id,
        isAdmin: can(profile, 'admin:access'),
      })
    : false;

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  const values = (await loadProfileForm(locals.db, user.id))!;
  const profile = await locals.getProfile();
  const connected = locals.supabase ? await connections(locals.supabase) : null;

  return {
    form: initialForm(values),
    photoForm: initialForm({ photo: undefined as File | undefined }),
    deleteForm: initialForm({ confirm: '' }),
    disconnectForm: initialForm({ provider: 'google' as const }),
    // The ways to sign in: provider names only, never anything else Auth knows about them.
    connections: connected,
    // A provider-only account may add a password (an e-mailed code, then the password).
    canAddPassword: Boolean(
      connected && !connected.email && (await passwordOffered(locals, profile)),
    ),
    passwordForm: initialForm({ code: '', password: '', passwordConfirm: '' }),
    messagesForm: initialForm({ enabled: profile?.directMessagesEnabled ?? true }),
    email: user.email ?? '',
    avatarUrl: profile ? pictureOf(supabaseUrlOf(locals.env), profile) : null,
    hasUploadedPhoto: Boolean(profile?.avatarPath),
    username: values.username,
  };
};

export const actions: Actions = {
  save: async ({ request, locals, url }) => {
    const user = await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');

    // The username is chosen once: validate with the stored identity, including normalization of other fields.
    const values = await request.formData();
    values.set('username', (await loadProfileForm(locals.db, user.id))!.username);
    const form = validateFormData(values, profileSchema, PROFILE_DEFAULTS, {
      arrays: ['linkNetwork', 'linkUrl'],
    });
    if (!form.valid) return fail(400, { form });

    // Through the api Worker when `api_account` is on for this person; here otherwise.
    const profile = await locals.getProfile();
    const remote = profile
      ? await writeViaApi(locals, 'api_account', profile, '/v1/account/save', form.data)
      : null;
    if (!remote) await saveProfile(locals.db, user.id, form.data);
    return { form };
  },

  // The switch for direct messages: it saves on its own, apart from the profile form.
  messages: async ({ request, locals, url }) => {
    const user = await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');

    const messagesForm = validateFormData(
      await request.formData(),
      directMessagesSchema,
      { enabled: false },
      { booleans: ['enabled'] },
    );
    if (!messagesForm.valid) return fail(400, { form: messagesForm });

    const profile = await locals.getProfile();
    const remote = profile
      ? await writeViaApi(locals, 'api_account', profile, '/v1/account/messages', messagesForm.data)
      : null;
    if (!remote) await setDirectMessages(locals.db, user.id, messagesForm.data.enabled);
    return { form: messagesForm };
  },

  // Disconnects a provider from the account. Never the last way to sign in.
  disconnect: async ({ request, locals, url }) => {
    await requireUser(locals, url);
    if (!locals.supabase) error(503, 'Auth not configured');

    const form = validateStringForm(await request.formData(), disconnectSchema, ['provider']);
    if (!form.valid) return fail(400, { form });

    try {
      await unlink(locals.supabase, form.data.provider);
    } catch (e) {
      if (e instanceof Forbidden) return refuse(form, 409, 'last_identity', 'provider');
      if (e instanceof NotFound) return refuse(form, 404, 'not_connected', 'provider');
      if (e instanceof Invalid) return refuse(form, 502, e.message, 'provider');
      throw e;
    }
    redirect(303, `${url.pathname}?conta=desconectada`);
  },

  // Step one of adding a password: the api e-mails a code to the address of the account.
  passwordCode: async ({ locals, url }) => {
    const user = await requireUser(locals, url);
    const form = initialForm({ code: '' });
    return viaPasswordApi(locals, user.id, '/v1/account/password/code', {}, form);
  },

  // Step two: the code and the new password, typed twice. Nothing typed is handed back.
  addPassword: async ({ request, locals, url }) => {
    const user = await requireUser(locals, url);
    const form = validateStringForm(await request.formData(), addPasswordFormSchema, [
      'code',
      'password',
      'passwordConfirm',
    ]);
    const { code, password } = form.data;
    withoutSecrets(form, ['password', 'passwordConfirm']);
    if (!form.valid) return fail(400, { form });

    return viaPasswordApi(locals, user.id, '/v1/account/password', { code, password }, form);
  },

  photo: async ({ request, locals, url }) => {
    const user = await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');

    // Files are allowed so the schema can check the picture; every failure below strips them.
    const photoForm = validateFormData(
      await request.formData(),
      photoSchema,
      { photo: undefined },
      { files: ['photo'] },
    );
    if (!photoForm.valid) return fail(400, { form: responseForm(photoForm) });

    try {
      const prepared = await prepareImage(photoForm.data.photo, user.id);
      const storage = locals.supabase?.storage.from(AVATAR_BUCKET);
      if (!storage) throw new Invalid('image', 'upload_failed');
      const path = await storeImage(storage, prepared, locals.log);
      await removePicture(locals, await setAvatar(locals, user.id, path));
    } catch (e) {
      if (e instanceof Invalid) return refuse(photoForm, 400, e.message, 'photo');
      throw e;
    }
    // A fresh request, so the header shows the new picture too.
    redirect(303, `${url.pathname}?foto=salva`);
  },

  removePhoto: async ({ locals, url }) => {
    const user = await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');

    await removePicture(locals, await setAvatar(locals, user.id, null));
    redirect(303, `${url.pathname}?foto=removida`);
  },

  // Closes the account: the database first (tables disabled, seats and ratings gone), then the
  // calendar cancellations, then the profile is emptied and the Auth user deleted.
  delete: async (event) => {
    const { request, locals, url } = event;
    const user = await requireUser(locals, url);
    if (!locals.db) error(503, 'Database not configured');

    const admin = supabaseAdminFrom(locals.env);
    if (!admin) error(503, 'Account deletion is not configured');

    const username = (await loadProfileForm(locals.db, user.id))!.username;
    const form = validateStringForm(await request.formData(), deleteAccountSchema, ['confirm']);
    if (!form.valid || form.data.confirm !== username)
      return refuse(form, 400, 'confirm', 'confirm');

    // The picture goes first, with the person's own session: after the Auth user is gone it cannot.
    await removePicture(locals, (await locals.getProfile())?.avatarPath ?? null);
    const profile = await locals.getProfile();
    // Through the api Worker when `api_account` is on for this person; here otherwise.
    try {
      const remote = profile
        ? await writeViaApi(locals, 'api_account', profile, '/v1/account/delete', {
            confirm: form.data.confirm,
          })
        : null;
      if (!remote)
        await deleteAccount(
          { db: locals.db, admin, handlers: handlersFor(locals.env), log: locals.log },
          user.id,
          form.data.confirm,
        );
    } catch (e) {
      if (e instanceof Invalid) return refuse(form, 400, 'confirm', 'confirm');
      throw e;
    }
    await locals.supabase?.auth.signOut();

    redirect(303, '/');
  },
};

/**
 * Calls the api's password route as the signed-in person, with their own access token (Supabase
 * vouches for it there). A refusal the api made becomes the form's error; a call that cannot be made
 * (no binding, flag off, no token) is "unavailable", because the web Worker has no path of its own.
 */
async function viaPasswordApi<T extends Record<string, unknown>>(
  locals: App.Locals,
  userId: string,
  path: string,
  body: Record<string, unknown>,
  form: Parameters<typeof refuse<T>>[0],
) {
  const profile = await locals.getProfile();
  const token = (await locals.supabase?.auth.getSession())?.data.session?.access_token;
  if (!profile || !token || profile.id !== userId) return refuse(form, 503, 'unavailable');

  try {
    const sent = await writeViaApi(locals, 'api_password', profile, path, body, {
      authorization: `Bearer ${token}`,
    });
    if (!sent) return refuse(form, 503, 'unavailable');
    return { form: responseForm(form) };
  } catch (e) {
    if (e instanceof Invalid) return refuse(form, 400, e.message, e.field);
    if (e instanceof RateLimited) return refuse(form, 429, 'rate_limited');
    if (e instanceof Forbidden) return refuse(form, 403, 'no_session');
    throw e;
  }
}

/**
 * Points the profile at a stored picture (or at none) and answers the file it replaced, for the
 * caller to delete with the person's session. Through the api Worker when `api_account` is on.
 */
async function setAvatar(locals: App.Locals, userId: string, path: string | null) {
  const profile = await locals.getProfile();
  const remote = profile
    ? await writeViaApi(locals, 'api_account', profile, '/v1/account/avatar', { path })
    : null;
  if (remote) return typeof remote.body.replaced === 'string' ? remote.body.replaced : null;
  return setAvatarPath(locals.db!, userId, path);
}
