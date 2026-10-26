import { fail, redirect, error } from '@sveltejs/kit';
import { initialForm, validateStringForm } from '#lib/forms/contract.js';
import { refuse, responseForm, withoutSecrets } from '#lib/forms/server.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { disconnectSchema } from '#lib/profile/connections.js';
import { addPasswordFormSchema } from '@mesaaberta/core/auth/password-setup';
import { hasPassword } from '@mesaaberta/core/server/auth/has-password';
import { connections, unlink } from '@mesaaberta/core/server/auth/identities';
import { can } from '@mesaaberta/core/server/auth/policy';
import { Forbidden, Invalid, NotFound, RateLimited } from '@mesaaberta/core/server/errors';
import type { Actions, PageServerLoad } from './$types';

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

// "Conta e acesso": the email, the @usuário and the ways to sign in.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');

  const profile = await locals.getProfile();
  const linked = locals.supabase ? await connections(locals.supabase) : null;
  // A password set on a provider account adds no `email` identity, so `auth.users` says whether
  // the e-mail and password way in is on. `total` stays the identities: it guards disconnecting.
  const connected =
    linked && !linked.email && (await hasPassword(locals.db, user.id))
      ? { ...linked, email: true }
      : linked;
  return {
    email: user.email ?? '',
    disconnectForm: initialForm({ provider: 'google' as const }),
    // The ways to sign in: provider names only, never anything else Auth knows about them.
    connections: connected,
    // A provider-only account may add a password (an e-mailed code, then the password).
    canAddPassword: Boolean(
      connected && !connected.email && (await passwordOffered(locals, profile)),
    ),
    passwordForm: initialForm({ code: '', password: '', passwordConfirm: '' }),
  };
};

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
