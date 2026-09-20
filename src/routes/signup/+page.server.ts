import { fail, redirect } from '@sveltejs/kit';
import { parseCredentials } from '$lib/auth/credentials';
import { signUpWithEmail, type SignUpResult } from '$lib/server/auth/email';
import { safeNext } from '$lib/server/auth/safe-next';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const next = safeNext(url.searchParams.get('next'));
	if (await locals.getUser()) redirect(303, next);

	return { next };
};

const STATUS: Record<Exclude<SignUpResult, 'signed_in' | 'check_email'>, number> = {
	weak_password: 400,
	failed: 500,
	rate_limited: 429
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.supabase) redirect(303, '/login?error=unavailable');

		const form = await request.formData();
		const next = safeNext(String(form.get('next') ?? ''));
		const credentials = parseCredentials(form);
		const email = String(form.get('email') ?? '').slice(0, 254);
		if (!credentials.ok) return fail(400, { errors: credentials.errors, email });

		const result = await signUpWithEmail(
			{ supabase: locals.supabase, db: locals.db, log: locals.log },
			{ ...credentials.data, origin: url.origin, next }
		);

		if (result === 'signed_in') redirect(303, next);
		// Says the same whether or not the address already had an account.
		if (result === 'check_email') return { checkEmail: true };

		return fail(STATUS[result], { result, email });
	}
};
