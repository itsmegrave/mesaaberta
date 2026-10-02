import { redirect } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { initialForm, validateStringForm } from '$lib/forms/contract';
import { formMessage } from '$lib/forms/server';
import { emailSchema } from '$lib/auth/credentials';
import { PASSWORD_RESET_LIMIT, attemptWait } from '$lib/server/auth/attempt-limit';
import { requestPasswordReset } from '$lib/server/auth/password';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => ({
  // Set when a link that no longer works sent the person here. A flag only: it is never shown itself.
  linkExpired: url.searchParams.has('error'),
  form: initialForm({ email: '' }),
});

export const actions: Actions = {
  default: async ({ request, locals, url, getClientAddress, setHeaders }) => {
    if (!locals.supabase) redirect(303, '/login?error=unavailable');

    const form = validateStringForm(await request.formData(), emailSchema, ['email']);
    if (!form.valid) return fail(400, { form });
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
