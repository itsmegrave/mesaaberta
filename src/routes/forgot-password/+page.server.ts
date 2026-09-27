import { redirect } from '@sveltejs/kit';
import { fail, message, superValidate, type SuperValidated } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { emailSchema } from '$lib/auth/credentials';
import type { FormMessage } from '$lib/forms/message';
import { requestPasswordReset } from '$lib/server/auth/password';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => ({
	// Set when a link that no longer works sent the person here. A flag only: it is never shown itself.
	linkExpired: url.searchParams.has('error'),
	form: await superValidate(zod4(emailSchema))
});

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.supabase) redirect(303, '/login?error=unavailable');

		const form: SuperValidated<{ email: string }, FormMessage> = await superValidate(
			request,
			zod4(emailSchema)
		);
		if (!form.valid) return fail(400, { form });

		const result = await requestPasswordReset(
			{ supabase: locals.supabase, log: locals.log },
			{ email: form.data.email, origin: url.origin }
		);

		// The same answer whether or not the address has an account.
		if (result === 'sent') return message(form, { code: 'sent' });
		return message(form, { code: result }, { status: result === 'rate_limited' ? 429 : 500 });
	}
};
