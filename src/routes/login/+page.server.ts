import { fail, redirect } from '@sveltejs/kit';
import { parseCredentials } from '$lib/auth/credentials';
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
		confirmHint: url.searchParams.get('error') === 'exchange_failed'
	};
};

const STATUS: Record<Exclude<SignInResult, 'ok'>, number> = {
	invalid: 400,
	unconfirmed: 400,
	failed: 500,
	rate_limited: 429
};

export const actions: Actions = {
	// Email and password. Supabase checks them; a wrong email and a wrong password look the same.
	email: async ({ request, locals }) => {
		if (!locals.supabase) redirect(303, '/login?error=unavailable');

		const form = await request.formData();
		const next = safeNext(String(form.get('next') ?? ''));
		const credentials = parseCredentials(form);
		const email = String(form.get('email') ?? '').slice(0, 254);
		// Only the email is handed back to refill the form, never the password.
		if (!credentials.ok) return fail(400, { errors: credentials.errors, email });

		const result = await signInWithEmail(
			{ supabase: locals.supabase, db: locals.db, log: locals.log },
			credentials.data
		);
		if (result !== 'ok') return fail(STATUS[result], { result, email });

		redirect(303, await afterSignIn(locals, next));
	}
};
