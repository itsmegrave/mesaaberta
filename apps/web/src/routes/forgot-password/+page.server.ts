import { redirect } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { initialForm, validateStringForm } from '#lib/forms/contract.js';
import { formMessage } from '#lib/forms/server.js';
import { emailSchema } from '#lib/auth/credentials.js';
import { PASSWORD_RESET_LIMIT, attemptWait } from '@mesaaberta/core/server/auth/attempt-limit';
import { requestPasswordReset } from '@mesaaberta/core/server/auth/password';
import { callApiRaw } from '#lib/server/api-client.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => ({
  // Set when a link that no longer works sent the person here. A flag only: it is never shown itself.
  linkExpired: url.searchParams.has('error'),
  form: initialForm({ email: '' }),
});

export const actions: Actions = {
  default: async ({ request, locals, url, getClientAddress, setHeaders }) => {
    const viaApi = await locals.flags.isEnabled('api_auth', {});
    if (!viaApi && !locals.supabase) redirect(303, '/login?error=unavailable');

    const form = validateStringForm(await request.formData(), emailSchema, ['email']);
    if (!form.valid) return fail(400, { form });
    // Behind `api_auth` the api Worker applies the limit and sends the e-mail; a call that cannot be
    // made falls through to the same work here, so the flag is a kill switch and not a dependency.
    const answer = viaApi
      ? await callApiRaw(
          locals.env,
          '/v1/auth/password-reset',
          null,
          locals.log,
          { email: form.data.email, origin: url.origin },
          { 'x-client-ip': getClientAddress() },
        )
      : null;
    const remote = (answer?.body ?? {}) as { result?: string; retryAfter?: number };
    if (answer && (remote.result === 'sent' || remote.result === 'failed'))
      return remote.result === 'sent'
        ? formMessage(form, { code: 'sent' })
        : formMessage(form, { code: 'failed' }, { status: 500 });
    if (answer && remote.result === 'rate_limited') {
      const retryAfter = remote.retryAfter ?? 60;
      setHeaders({ 'Retry-After': String(retryAfter) });
      return formMessage(form, { code: 'rate_limited', retryAfter }, { status: 429 });
    }
    if (!locals.supabase) redirect(303, '/login?error=unavailable');

    // Each request sends an e-mail: without a limit, a script could flood someone's inbox.
    const wait = await attemptWait(locals.db, PASSWORD_RESET_LIMIT, getClientAddress());
    if (wait !== null) {
      setHeaders({ 'Retry-After': String(wait) });
      return formMessage(form, { code: 'rate_limited', retryAfter: wait }, { status: 429 });
    }

    const result = await requestPasswordReset(
      { supabase: locals.supabase, log: locals.log },
      { email: form.data.email, origin: url.origin },
    );

    // The same answer whether or not the address has an account.
    if (result === 'sent') return formMessage(form, { code: 'sent' });
    return formMessage(form, { code: result }, { status: result === 'rate_limited' ? 429 : 500 });
  },
};
