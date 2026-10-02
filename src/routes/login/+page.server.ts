import { redirect } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { initialForm, validateStringForm } from '$lib/forms/contract';
import { formMessage } from '$lib/forms/server';
import { credentialsSchema } from '$lib/auth/credentials';
import { withoutSecrets } from '$lib/forms/server';
import { SIGN_IN_LIMIT, attemptWait } from '$lib/server/auth/attempt-limit';
import { signInWithEmail, type SignInResult } from '$lib/server/auth/email';
import { afterSignIn } from '$lib/server/auth/onboarding';
import { safeNext } from '$lib/server/auth/safe-next';
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
  };
};

const STATUS = {
  invalid: 400,
  unconfirmed: 400,
  suspended: 403,
  failed: 500,
  rate_limited: 429,
} as const satisfies Record<Exclude<SignInResult, 'ok'>, number>;

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
    // Counted per network before Supabase sees it, so a script cannot guess passwords in a loop.
    const wait = await attemptWait(locals.db, SIGN_IN_LIMIT, getClientAddress());
    if (wait !== null) {
      setHeaders({ 'Retry-After': String(wait) });
      return formMessage(form, { code: 'rate_limited', retryAfter: wait }, { status: 429 });
    }

    const result = await signInWithEmail(
      { supabase: locals.supabase, db: locals.db, log: locals.log, ip: getClientAddress() },
      { email, password },
    );
    if (result !== 'ok') return formMessage(form, { code: result }, { status: STATUS[result] });

    redirect(303, await afterSignIn(locals, next));
  },
};
