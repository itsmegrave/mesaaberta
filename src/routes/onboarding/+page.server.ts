import { error, fail, redirect } from '@sveltejs/kit';
import { setError, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { requireUser } from '$lib/server/auth/guard';
import { ensureProfile } from '$lib/server/auth/profile';
import { safeNext } from '$lib/server/auth/safe-next';
import { Invalid } from '$lib/server/errors';
import { isUsernameAvailable, loadProfileForm, saveProfile } from '$lib/server/profile/service';
import { profileSchema } from '$lib/profile/schema';
import { suggestUsername } from '$lib/profile/username';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	// The one authenticated page an incomplete profile may reach.
	const user = await requireUser(locals, url, { allowIncomplete: true });
	if (!locals.db) error(503, 'Database not configured');

	const next = safeNext(url.searchParams.get('next'));
	// Also covers someone who signed in before profiles existed: there is nothing to finish without one.
	const profile = await ensureProfile(locals.db, user);
	if (profile.username) redirect(303, next);

	const values = (await loadProfileForm(locals.db, user.id))!;
	// The name from the sign-in provider suggests a username, unless somebody already has it.
	const suggestion = suggestUsername(values.name);
	if (suggestion && (await isUsernameAvailable(locals.db, suggestion)))
		values.username = suggestion;

	return { form: await superValidate(values, zod4(profileSchema), { errors: false }), next };
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const user = await requireUser(locals, url, { allowIncomplete: true });
		if (!locals.db) error(503, 'Database not configured');

		const form = await superValidate(request, zod4(profileSchema));
		if (!form.valid) return fail(400, { form });

		try {
			await ensureProfile(locals.db, user);
			await saveProfile(locals.db, user.id, form.data);
		} catch (e) {
			// The unique index decided: somebody took the name after the availability check.
			if (e instanceof Invalid && e.field === 'username') {
				return setError(form, 'username', 'taken', { status: 400 });
			}
			throw e;
		}

		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
