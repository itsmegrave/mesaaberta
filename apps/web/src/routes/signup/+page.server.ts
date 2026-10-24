import { redirect } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { initialForm, validateStringForm } from '#lib/forms/contract.js';
import { formMessage } from '#lib/forms/server.js';
import { credentialsSchema } from '#lib/auth/credentials.js';
import { withoutSecrets } from '#lib/forms/server.js';
import { SIGN_UP_LIMIT, attemptKey, attemptWait } from '@mesaaberta/core/server/auth/attempt-limit';
import { signUpWithEmail, type SignUpResult } from '@mesaaberta/core/server/auth/email';
import { callApiRaw } from '#lib/server/api-client.js';
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
 * Signs up through the api Worker (behind `api_auth_sign_up`), which answers the JWT pair when the
 * person is signed in at once; it is set here as the cookie session (Supabase verifies it again).
 * Resolves to the result to show, or to null when the flag is off or the call cannot be used, so
 * the caller signs up here. `session_lost`: the account exists but the session did not set.
 */
async function signUpViaApi(
  locals: App.Locals,
  ip: string,
  details: { email: string; password: string; origin: string; next: string },
): Promise<Via | null> {
  if (!locals.supabase) return null;
  // Nobody is signed in to target, so the visitor's network (hashed) stands in for the user id.
  const id = await attemptKey('sign_up', ip);
  if (!(await locals.flags.isEnabled('api_auth_sign_up', { id }))) return null;

  const answer = await callApiRaw(locals.env, '/v1/auth/sign-up', null, locals.log, details, {
    'x-client-ip': ip,
  });
  const remote = (answer?.body ?? {}) as {
    result?: SignUpResult;
    retryAfter?: number;
    session?: { accessToken?: string; refreshToken?: string };
  };
  if (!answer || !remote.result) return null;
  if (remote.result === 'check_email' || remote.result in STATUS)
    return { result: remote.result, retryAfter: remote.retryAfter };
  if (remote.result !== 'signed_in') return null;

  const { accessToken, refreshToken } = remote.session ?? {};
  const set =
    accessToken && refreshToken
      ? await locals.supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
      : { error: true };
  if (set.error) {
    locals.log.warn('api sign-up session not set', { code: 'api_session_rejected' });
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
    if (viaApi) {
      const { result } = viaApi;
      // The account exists, so signing up again would not help: the person signs in instead.
      if (result === 'session_lost') redirect(303, `/login?next=${encodeURIComponent(next)}`);
      if (result === 'signed_in') redirect(303, await afterSignIn(locals, next));
      if (result === 'check_email') return formMessage(form, { code: 'check_email' });
      if (result === 'rate_limited') {
        const retryAfter = ('retryAfter' in viaApi && viaApi.retryAfter) || 60;
        setHeaders({ 'Retry-After': String(retryAfter) });
        return formMessage(form, { code: 'rate_limited', retryAfter }, { status: 429 });
      }
      return formMessage(form, { code: result }, { status: STATUS[result] });
    }

    const wait = await attemptWait(locals.db, SIGN_UP_LIMIT, getClientAddress());
    if (wait !== null) {
      setHeaders({ 'Retry-After': String(wait) });
      return formMessage(form, { code: 'rate_limited', retryAfter: wait }, { status: 429 });
    }

    const result = await signUpWithEmail(
      { supabase: locals.supabase, db: locals.db, log: locals.log, ip: getClientAddress() },
      { email, password, origin: url.origin, next },
    );

    if (result === 'signed_in') redirect(303, await afterSignIn(locals, next));
    // Says the same whether or not the address already had an account.
    if (result === 'check_email') return formMessage(form, { code: 'check_email' });

    return formMessage(form, { code: result }, { status: STATUS[result] });
  },
};
