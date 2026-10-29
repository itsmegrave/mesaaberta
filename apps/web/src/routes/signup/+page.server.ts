import { redirect } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { initialForm, validateStringForm } from '#lib/forms/contract.js';
import { formMessage } from '#lib/forms/server.js';
import { credentialsSchema } from '#lib/auth/credentials.js';
import { withoutSecrets } from '#lib/forms/server.js';
import type { SignUpResult } from '@mesaaberta/core/server/auth/email';
import { callApiRaw } from '#lib/server/api-client.js';
import { keepCodeVerifier } from '#lib/server/auth/code-verifier.js';
import { afterSignIn } from '@mesaaberta/core/server/auth/onboarding';
import { safeNext } from '@mesaaberta/core/server/auth/safe-next';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const next = safeNext(url.searchParams.get('next'));
  if (await locals.getUser()) redirect(303, next);

  return { next, form: initialForm({ email: '', password: '', next }) };
};

const STATUS = {
  weak_password: 400,
  failed: 500,
  rate_limited: 429,
} as const satisfies Record<Exclude<SignUpResult, 'signed_in' | 'check_email'>, number>;

type Via = { result: SignUpResult; retryAfter?: number } | { result: 'session_lost' };

/**
 * Signs up through the api Worker, which answers the JWT pair when the person is signed in at once;
 * it is set here as the cookie session (Supabase verifies it again). A call that cannot be used is
 * `failed`: the database work lives in the api. `session_lost`: the account exists but the session
 * did not set.
 */
async function signUpViaApi(
  locals: App.Locals,
  ip: string,
  details: { email: string; password: string; origin: string; next: string },
): Promise<Via> {
  if (!locals.supabase) return { result: 'failed' };

  const answer = await callApiRaw(locals.env, '/v1/auth/sign-up', null, locals.log, details, {
    'x-client-ip': ip,
  });
  const remote = (answer?.body ?? {}) as {
    result?: SignUpResult;
    retryAfter?: number;
    codeVerifier?: unknown;
    session?: { accessToken?: string; refreshToken?: string };
  };
  if (!answer || !remote.result) return { result: 'failed' };
  // The confirmation link comes back to /auth/callback, which needs this to trade its code.
  if (remote.result === 'check_email') await keepCodeVerifier(locals.supabase, remote.codeVerifier);
  if (remote.result === 'check_email' || remote.result in STATUS)
    return { result: remote.result, retryAfter: remote.retryAfter };
  if (remote.result !== 'signed_in') return { result: 'failed' };

  const { accessToken, refreshToken } = remote.session ?? {};
  const set =
    accessToken && refreshToken
      ? await locals.supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
      : { error: true };
  if (set.error) {
    locals.log.warn('auth.sign_up_session_not_set', { code: 'api_session_rejected' });
    return { result: 'session_lost' };
  }
  return { result: 'signed_in' };
}

export const actions: Actions = {
  default: async ({ request, locals, url, getClientAddress, setHeaders }) => {
    if (!locals.supabase) redirect(303, '/login?error=unavailable');

    const form = validateStringForm(await request.formData(), credentialsSchema, [
      'email',
      'password',
      'next',
    ]);
    const next = safeNext(form.data.next);
    const { email, password } = form.data;
    withoutSecrets(form, ['password']);
    if (!form.valid) return fail(400, { form });
    const viaApi = await signUpViaApi(locals, getClientAddress(), {
      email,
      password,
      origin: url.origin,
      next,
    });
    const { result } = viaApi;
    // The account exists, so signing up again would not help: the person signs in instead.
    if (result === 'session_lost') redirect(303, `/login?next=${encodeURIComponent(next)}`);
    if (result === 'signed_in') redirect(303, await afterSignIn(locals, next));
    // Says the same whether or not the address already had an account.
    if (result === 'check_email') return formMessage(form, { code: 'check_email' });
    if (result === 'rate_limited') {
      const retryAfter = ('retryAfter' in viaApi && viaApi.retryAfter) || 60;
      setHeaders({ 'Retry-After': String(retryAfter) });
      return formMessage(form, { code: 'rate_limited', retryAfter }, { status: 429 });
    }
    return formMessage(form, { code: result }, { status: STATUS[result] });
  },
};
