import { redirect } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { initialForm, validateStringForm } from '#lib/forms/contract.js';
import { formMessage } from '#lib/forms/server.js';
import { credentialsSchema } from '#lib/auth/credentials.js';
import { withoutSecrets } from '#lib/forms/server.js';
import type { SignInResult } from '@mesaaberta/core/server/auth/email';
import { callApiRaw } from '#lib/server/api-client.js';
import { afterSignIn } from '@mesaaberta/core/server/auth/onboarding';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import {
  finishPasskeyLogin,
  parseCredential,
  signInChallenge,
} from '@mesaaberta/core/server/auth/passkeys';
import { passkeyAnswerSchema } from '#lib/auth/passkey.js';
import { finishLoginViaApi } from '#lib/server/auth/finish-login.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const next = safeNext(url.searchParams.get('next'));
  if (await locals.getUser()) redirect(303, next);

  // The `error` value picks one of a few fixed messages; it is never shown itself, so it cannot be used to inject text.
  return {
    next,
    failed: url.searchParams.has('error'),
    confirmHint: url.searchParams.get('error') === 'exchange_failed',
    suspended: url.searchParams.get('error') === 'suspended',
    form: initialForm({ email: '', password: '', next }),
    passkeys: await passkeysOn(locals),
  };
};

/** "Entrar com passkey" (`use_passkeys`), evaluated for the anonymous visitor. */
const passkeysOn = (locals: App.Locals) =>
  locals.supabase ? locals.flags.isEnabled('use_passkeys') : Promise.resolve(false);

const STATUS = {
  invalid: 400,
  unconfirmed: 400,
  suspended: 403,
  failed: 500,
  rate_limited: 429,
} as const satisfies Record<Exclude<SignInResult, 'ok'>, number>;

/**
 * Signs in through the api Worker: it applies the limit, checks the password with Supabase and
 * answers the JWT pair, which is set here as the cookie session (Supabase verifies the token again
 * when it is set). A call that cannot be used (no binding, a failure, a session that does not set)
 * is `failed`: the database work lives in the api.
 */
async function signInViaApi(
  locals: App.Locals,
  ip: string,
  credentials: { email: string; password: string },
): Promise<{ result: SignInResult; retryAfter?: number }> {
  if (!locals.supabase) return { result: 'failed' };
  const answer = await callApiRaw(locals.env, '/v1/auth/sign-in', null, locals.log, credentials, {
    'x-client-ip': ip,
  });
  const remote = (answer?.body ?? {}) as {
    result?: SignInResult;
    retryAfter?: number;
    session?: { accessToken?: string; refreshToken?: string };
  };
  if (!answer || !remote.result || !(remote.result in STATUS || remote.result === 'ok'))
    return { result: 'failed' };
  if (remote.result !== 'ok') return { result: remote.result, retryAfter: remote.retryAfter };

  const { accessToken, refreshToken } = remote.session ?? {};
  if (!accessToken || !refreshToken) return { result: 'failed' };
  const { error } = await locals.supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    locals.log.warn('auth.sign_in_session_not_set', { code: 'api_session_rejected' });
    return { result: 'failed' };
  }
  return { result: 'ok' };
}

export const actions: Actions = {
  // Email and password. Supabase checks them; a wrong email and a wrong password look the same.
  email: async ({ request, locals, getClientAddress, setHeaders }) => {
    if (!locals.supabase) redirect(303, '/login?error=unavailable');

    const form = validateStringForm(await request.formData(), credentialsSchema, [
      'email',
      'password',
      'next',
    ]);
    const next = safeNext(form.data.next);
    const { email, password } = form.data;
    // Only the email is handed back to refill the form, never the password.
    withoutSecrets(form, ['password']);
    if (!form.valid) return fail(400, { form });

    const viaApi = await signInViaApi(locals, getClientAddress(), { email, password });
    if (viaApi.result === 'ok') redirect(303, await afterSignIn(locals, next));
    if (viaApi.result === 'rate_limited') {
      const retryAfter = viaApi.retryAfter ?? 60;
      setHeaders({ 'Retry-After': String(retryAfter) });
      return formMessage(form, { code: 'rate_limited', retryAfter }, { status: 429 });
    }
    return formMessage(form, { code: viaApi.result }, { status: STATUS[viaApi.result] });
  },

  // Step one of "Entrar com passkey": a challenge from Supabase for the browser's passkey prompt.
  // No account is named; the browser offers the passkeys it holds for this site.
  passkeyOptions: async ({ request, locals }) => {
    if (!locals.supabase || !(await passkeysOn(locals))) return fail(404, { passkey: 'off' });
    const captcha = (await request.formData()).get('captchaToken');
    const challenge = await signInChallenge(
      locals.supabase,
      locals.log,
      typeof captcha === 'string' && captcha ? captcha : undefined,
    );
    if (!challenge) return fail(503, { passkey: 'unavailable' });
    return { challenge };
  },

  // Step two: the browser's answer. Supabase checks it and makes the session (the cookies); the
  // api then finishes the sign-in like a provider's, and any refusal there signs the person out.
  passkey: async ({ request, locals, getClientAddress }) => {
    if (!locals.supabase || !(await passkeysOn(locals))) return fail(404, { passkey: 'off' });
    const form = validateStringForm(await request.formData(), passkeyAnswerSchema, [
      'challengeId',
      'credential',
      'next',
    ]);
    const credential = form.valid ? parseCredential(form.data.credential) : null;
    if (!credential) return fail(400, { passkey: 'invalid' });

    const ip = getClientAddress();
    const target = await finishPasskeyLogin(
      {
        supabase: locals.supabase,
        db: null,
        log: locals.log,
        ip,
        remote: finishLoginViaApi(locals, ip),
      },
      { challengeId: form.data.challengeId, credential, next: form.data.next || null },
    );
    if (!target) return fail(400, { passkey: 'refused' });
    redirect(303, target);
  },
};
