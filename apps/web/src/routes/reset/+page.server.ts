import { redirect } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { initialForm, validateStringForm } from '#lib/forms/contract.js';
import { formMessage } from '#lib/forms/server.js';
import { newPasswordSchema } from '#lib/auth/credentials.js';
import { withoutSecrets } from '#lib/forms/server.js';
import { callApiRaw } from '#lib/server/api-client.js';
import { changePassword, type ChangePasswordResult } from '@mesaaberta/core/server/auth/password';
import type { Actions, PageServerLoad } from './$types';

// This page is only for someone the recovery link just signed in. Without a session (an expired or
// used link, or one opened in another browser) there is nothing to change a password for.
export const load: PageServerLoad = async ({ locals, url }) => {
  if (!(await locals.getUser())) redirect(303, '/forgot?error=link');

  return {
    done: url.searchParams.has('done'),
    form: initialForm({ password: '', passwordConfirm: '' }),
  };
};

const STATUS = {
  weak_password: 400,
  same_password: 400,
  rate_limited: 429,
  failed: 500,
} as const satisfies Record<Exclude<ChangePasswordResult, 'ok' | 'no_session'>, number>;

/**
 * Sets the password through the api Worker (behind `api_auth_new_password`) with the person's own
 * access token. Resolves to the result, or to null when the flag is off or the call cannot be used,
 * so the caller changes it in this Worker.
 */
async function changeViaApi(
  locals: App.Locals,
  userId: string,
  passwords: { password: string; passwordConfirm: string },
): Promise<ChangePasswordResult | null> {
  if (!(await locals.flags.isEnabled('api_auth_new_password', { id: userId }))) return null;
  const token = (await locals.supabase?.auth.getSession())?.data.session?.access_token;
  if (!token) return null;

  const answer = await callApiRaw(
    locals.env,
    '/v1/auth/new-password',
    null,
    locals.log,
    passwords,
    {
      authorization: `Bearer ${token}`,
    },
  );
  const result = (answer?.body as { result?: string } | undefined)?.result;
  return result === 'ok' || (result && result in STATUS) || result === 'no_session'
    ? (result as ChangePasswordResult)
    : null;
}

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const user = locals.supabase ? await locals.getUser() : null;
    if (!locals.supabase || !user) redirect(303, '/forgot?error=link');

    const form = validateStringForm(await request.formData(), newPasswordSchema, [
      'password',
      'passwordConfirm',
    ]);
    const { password, passwordConfirm } = form.data;
    // Nothing typed is handed back: not even the password's length.
    withoutSecrets(form, ['password', 'passwordConfirm']);
    if (!form.valid) return fail(400, { form });

    const result =
      (await changeViaApi(locals, user.id, { password, passwordConfirm })) ??
      (await changePassword({ supabase: locals.supabase, log: locals.log }, { password }));

    if (result === 'ok') redirect(303, '/reset?done=1');
    if (result === 'no_session') redirect(303, '/forgot?error=link');

    return formMessage(form, { code: result }, { status: STATUS[result] });
  },
};
