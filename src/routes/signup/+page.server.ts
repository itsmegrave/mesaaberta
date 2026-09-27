import { redirect } from '@sveltejs/kit';
import { fail, message, superValidate, type SuperValidated } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { credentialsSchema, type CredentialsData } from '$lib/auth/credentials';
import type { FormMessage } from '$lib/forms/message';
import { withoutSecrets } from '$lib/forms/server';
import { signUpWithEmail, type SignUpResult } from '$lib/server/auth/email';
import { afterSignIn } from '$lib/server/auth/onboarding';
import { safeNext } from '$lib/server/auth/safe-next';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const next = safeNext(url.searchParams.get('next'));
	if (await locals.getUser()) redirect(303, next);

	return { next, form: await superValidate({ next }, zod4(credentialsSchema), { errors: false }) };
};

const STATUS = {
	weak_password: 400,
	failed: 500,
	rate_limited: 429
} as const satisfies Record<Exclude<SignUpResult, 'signed_in' | 'check_email'>, number>;

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.supabase) redirect(303, '/login?error=unavailable');

		const form: SuperValidated<CredentialsData, FormMessage> = await superValidate(
			request,
			zod4(credentialsSchema)
		);
		const next = safeNext(form.data.next);
		const { email, password } = form.data;
		withoutSecrets(form, ['password']);
		if (!form.valid) return fail(400, { form });

		const result = await signUpWithEmail(
			{ supabase: locals.supabase, db: locals.db, log: locals.log },
			{ email, password, origin: url.origin, next }
		);

		if (result === 'signed_in') redirect(303, await afterSignIn(locals, next));
		// Says the same whether or not the address already had an account.
		if (result === 'check_email') return message(form, { code: 'check_email' });

		return message(form, { code: result }, { status: STATUS[result] });
	}
};
