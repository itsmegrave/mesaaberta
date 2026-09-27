import { redirect } from '@sveltejs/kit';
import { fail, message, superValidate, type SuperValidated } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { newPasswordSchema } from '$lib/auth/credentials';
import type { FormMessage } from '$lib/forms/message';
import { withoutSecrets } from '$lib/forms/server';
import { changePassword, type ChangePasswordResult } from '$lib/server/auth/password';
import type { Actions, PageServerLoad } from './$types';

// This page is only for someone the recovery link just signed in. Without a session (an expired or
// used link, or one opened in another browser) there is nothing to change a password for.
export const load: PageServerLoad = async ({ locals, url }) => {
	if (!(await locals.getUser())) redirect(303, '/forgot-password?error=link');

	return { done: url.searchParams.has('done'), form: await superValidate(zod4(newPasswordSchema)) };
};

const STATUS = {
	weak_password: 400,
	same_password: 400,
	rate_limited: 429,
	failed: 500
} as const satisfies Record<Exclude<ChangePasswordResult, 'ok' | 'no_session'>, number>;

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.supabase || !(await locals.getUser())) redirect(303, '/forgot-password?error=link');

		const form: SuperValidated<{ password: string; passwordConfirm: string }, FormMessage> =
			await superValidate(request, zod4(newPasswordSchema));
		const { password } = form.data;
		// Nothing typed is handed back: not even the password's length.
		withoutSecrets(form, ['password', 'passwordConfirm']);
		if (!form.valid) return fail(400, { form });

		const result = await changePassword(
			{ supabase: locals.supabase, log: locals.log },
			{ password }
		);

		if (result === 'ok') redirect(303, '/reset-password?done=1');
		if (result === 'no_session') redirect(303, '/forgot-password?error=link');

		return message(form, { code: result }, { status: STATUS[result] });
	}
};
