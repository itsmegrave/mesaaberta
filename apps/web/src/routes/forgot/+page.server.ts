import { fail } from '@sveltejs/kit';
import { initialForm, validateStringForm } from '#lib/forms/contract.js';
import { formMessage } from '#lib/forms/server.js';
import { emailSchema } from '#lib/auth/credentials.js';
import { callApiRaw } from '#lib/server/api-client.js';
import { keepCodeVerifier } from '#lib/server/auth/code-verifier.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => ({
  // Set when a link that no longer works sent the person here. A flag only: it is never shown itself.
  linkExpired: url.searchParams.has('error'),
  form: initialForm({ email: '' }),
});

export const actions: Actions = {
  default: async ({ request, locals, url, getClientAddress, setHeaders }) => {
    const form = validateStringForm(await request.formData(), emailSchema, ['email']);
    if (!form.valid) return fail(400, { form });
    // The api Worker applies the limit and sends the e-mail; a call that cannot be made is `failed`.
    const answer = await callApiRaw(
      locals.env,
      '/v1/auth/password-reset',
      null,
      locals.log,
      { email: form.data.email, origin: url.origin },
      { 'x-client-ip': getClientAddress() },
    );
    const remote = (answer?.body ?? {}) as {
      result?: string;
      retryAfter?: number;
      codeVerifier?: unknown;
    };
    if (remote.result === 'rate_limited') {
      const retryAfter = remote.retryAfter ?? 60;
      setHeaders({ 'Retry-After': String(retryAfter) });
      return formMessage(form, { code: 'rate_limited', retryAfter }, { status: 429 });
    }
    // The same answer whether or not the address has an account.
    if (remote.result === 'sent') {
      // The e-mailed link comes back to /auth/callback, which needs this to trade its code.
      await keepCodeVerifier(locals.supabase, remote.codeVerifier);
      return formMessage(form, { code: 'sent' });
    }
    return formMessage(form, { code: 'failed' }, { status: 500 });
  },
};
