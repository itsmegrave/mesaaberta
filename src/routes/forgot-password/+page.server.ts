import { fail, redirect } from '@sveltejs/kit';
import { parseEmail } from '$lib/auth/credentials';
import { requestPasswordReset } from '$lib/server/auth/password';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({
	// Set when a link that no longer works sent the person here. A flag only: it is never shown itself.
	linkExpired: url.searchParams.has('error')
});

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.supabase) redirect(303, '/login?error=unavailable');

		const form = await request.formData();
		const email = String(form.get('email') ?? '').slice(0, 254);
		const parsed = parseEmail(form);
		if (!parsed.ok) return fail(400, { errors: parsed.errors, email });

		const result = await requestPasswordReset(
			{ supabase: locals.supabase, log: locals.log },
			{ email: parsed.data.email, origin: url.origin }
		);

		// The same answer whether or not the address has an account.
		if (result === 'sent') return { sent: true };
		return fail(result === 'rate_limited' ? 429 : 500, { result, email });
	}
};
