import { redirect } from '@sveltejs/kit';
import { fail, message, superValidate, type SuperValidated } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { credentialsSchema, type CredentialsData } from '$lib/auth/credentials';
import type { FormMessage } from '$lib/forms/message';
import { withoutSecrets } from '$lib/forms/server';
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
		form: await superValidate({ next }, zod4(credentialsSchema), { errors: false })
	};
};

const STATUS = {
	invalid: 400,
	unconfirmed: 400,
	failed: 500,
	rate_limited: 429
} as const satisfies Record<Exclude<SignInResult, 'ok'>, number>;

export const actions: Actions = {
	// Email and password. Supabase checks them; a wrong email and a wrong password look the same.
	email: async ({ request, locals }) => {
		if (!locals.supabase) redirect(303, '/login?error=unavailable');

		const form: SuperValidated<CredentialsData, FormMessage> = await superValidate(
			request,
			zod4(credentialsSchema)
		);
		const next = safeNext(form.data.next);
		const { email, password } = form.data;
		// Only the email is handed back to refill the form, never the password.
		withoutSecrets(form, ['password']);
		if (!form.valid) return fail(400, { form });

		const result = await signInWithEmail(
			{ supabase: locals.supabase, db: locals.db, log: locals.log },
			{ email, password }
		);
		if (result !== 'ok') return message(form, { code: result }, { status: STATUS[result] });

		redirect(303, await afterSignIn(locals, next));
	}
};
