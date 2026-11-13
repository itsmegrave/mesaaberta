import { fail, redirect, error, isHttpError } from '@sveltejs/kit';
import { initialForm, validateStringForm } from '#lib/forms/contract.js';
import { refuse, responseForm, withoutSecrets } from '#lib/forms/server.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { disconnectSchema } from '#lib/profile/connections.js';
import { addPasswordFormSchema } from '@mesaaberta/core/auth/password-setup';
import { readFromApi } from '#lib/server/api-read.js';
import { connections, unlink } from '@mesaaberta/core/server/auth/identities';
import { Forbidden, Invalid, NotFound, RateLimited } from '@mesaaberta/core/server/errors';
import {
  finishRegistration,
  listPasskeys,
  parseCredential,
  registrationChallenge,
  removePasskey,
} from '@mesaaberta/core/server/auth/passkeys';
import { passkeyAnswerSchema, passkeyRemoveSchema } from '#lib/auth/passkey.js';
import type { Actions, PageServerLoad } from './$types';

// "Conta e acesso": the email, the @usuário and the ways to sign in.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  const passkeysOn = await passkeysFor(locals, user.id);

  const linked = locals.supabase ? await connections(locals.supabase) : null;
  // A password set on a provider account adds no `email` identity, so `auth.users` says whether
  // the e-mail and password way in is on. `total` stays the identities: it guards disconnecting.
  const connected =
    linked &&
    !linked.email &&
    (await readFromApi<{ hasPassword: boolean }>(locals, user.id, '/v1/me/has-password'))
      .hasPassword
      ? { ...linked, email: true }
      : linked;
  return {
    email: user.email ?? '',
    disconnectForm: initialForm({ provider: 'google' as const }),
    // The ways to sign in: provider names only, never anything else Auth knows about them.
    connections: connected,
    // A provider-only account may add a password (an e-mailed code, then the password).
    canAddPassword: Boolean(connected && !connected.email),
    passwordForm: initialForm({ code: '', password: '', passwordConfirm: '' }),
    // The account's passkeys (`use_passkeys`); null is "could not load".
    passkeysOn,
    passkeys:
      passkeysOn && locals.supabase ? await listPasskeys(locals.supabase, locals.log) : null,
    passkeyRemoveForm: initialForm({ passkeyId: '' }),
  };
};

/** The Passkeys section (`use_passkeys`), targeted by the person's id. */
const passkeysFor = (locals: App.Locals, id: string) =>
  locals.supabase ? locals.flags.isEnabled('use_passkeys', { id }) : Promise.resolve(false);

export const actions: Actions = {
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

  // Adding a passkey, step one: a challenge from Supabase for the signed-in account.
  passkeyRegisterOptions: async ({ locals, url }) => {
    const user = await requireUser(locals, url);
    if (!locals.supabase || !(await passkeysFor(locals, user.id)))
      return fail(404, { passkey: 'off' });
    const challenge = await registrationChallenge(locals.supabase, locals.log);
    if (!challenge) return fail(503, { passkey: 'unavailable' });
    return { challenge };
  },

  // Step two: the passkey the browser made. Supabase checks and keeps it.
  passkeyRegister: async ({ request, locals, url }) => {
    const user = await requireUser(locals, url);
    if (!locals.supabase || !(await passkeysFor(locals, user.id)))
      return fail(404, { passkey: 'off' });
    const form = validateStringForm(await request.formData(), passkeyAnswerSchema, [
      'challengeId',
      'credential',
    ]);
    const credential = form.valid ? parseCredential(form.data.credential) : null;
    if (!credential) return fail(400, { passkey: 'invalid' });
    const kept = await finishRegistration(locals.supabase, locals.log, {
      challengeId: form.data.challengeId,
      credential,
    });
    if (!kept) return fail(400, { passkey: 'refused' });
    redirect(303, `${url.pathname}?passkey=adicionada`);
  },

  // Removes one passkey. Never the last way in: every account has e-mail or a provider as well.
  passkeyRemove: async ({ request, locals, url }) => {
    const user = await requireUser(locals, url);
    if (!locals.supabase || !(await passkeysFor(locals, user.id))) error(404);
    const form = validateStringForm(await request.formData(), passkeyRemoveSchema, ['passkeyId']);
    if (!form.valid) return fail(400, { form });
    if (!(await removePasskey(locals.supabase, locals.log, form.data.passkeyId)))
      return refuse(form, 502, 'remove_failed', 'passkeyId');
    redirect(303, `${url.pathname}?passkey=removida`);
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
};

/**
 * Calls the api's password route as the signed-in person, with their own access token (Supabase
 * vouches for it there). A refusal the api made becomes the form's error; a call that cannot be made
 * (no binding, no token, a failing api) is "unavailable", because the web Worker has no path of its own.
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
    await writeViaApi(locals, profile, path, body, { authorization: `Bearer ${token}` });
    return { form: responseForm(form) };
  } catch (e) {
    if (isHttpError(e) && e.status === 503) return refuse(form, 503, 'unavailable');
    if (e instanceof Invalid) return refuse(form, 400, e.message, e.field);
    if (e instanceof RateLimited) return refuse(form, 429, 'rate_limited');
    if (e instanceof Forbidden) return refuse(form, 403, 'no_session');
    throw e;
  }
}
