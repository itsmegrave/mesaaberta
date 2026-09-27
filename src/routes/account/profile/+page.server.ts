import { error, fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { anonymiseProfile, closeAccount } from '$lib/server/account/service';
import { deleteAuthUser, supabaseAdminFrom } from '$lib/server/auth/admin-client';
import { requireUser } from '$lib/server/auth/guard';
import { dispatchEvent } from '$lib/server/events/dispatcher';
import { handlersFor } from '$lib/server/events/handlers';
import { loadProfileForm, saveProfile } from '$lib/server/profile/service';
import { profileSchema } from '$lib/profile/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = await requireUser(locals, url);
	if (!locals.db) error(503, 'Database not configured');

	const values = (await loadProfileForm(locals.db, user.id))!;
	const profile = await locals.getProfile();

	return {
		form: await superValidate(values, zod4(profileSchema), { errors: false }),
		email: user.email ?? '',
		avatarUrl: profile?.avatarUrl ?? null,
		username: values.username
	};
};

export const actions: Actions = {
	save: async ({ request, locals, url }) => {
		const user = await requireUser(locals, url);
		if (!locals.db) error(503, 'Database not configured');

		const form = await superValidate(request, zod4(profileSchema));
		// The username is chosen once, at onboarding: whatever was sent, the stored one stays.
		const current = (await loadProfileForm(locals.db, user.id))!.username;
		form.data.username = current;
		delete form.errors.username;
		if (Object.keys(form.errors).length > 0) return fail(400, { form });

		await saveProfile(locals.db, user.id, form.data);
		return { form };
	},

	// Closes the account: the database first (tables disabled, seats and ratings gone), then the
	// calendar cancellations, then the profile is emptied and the Auth user deleted.
	delete: async (event) => {
		const { request, locals, url, platform } = event;
		const user = await requireUser(locals, url);
		if (!locals.db) error(503, 'Database not configured');

		const admin = supabaseAdminFrom(platform?.env);
		if (!admin) error(503, 'Account deletion is not configured');

		const username = (await loadProfileForm(locals.db, user.id))!.username;
		const typed = String((await request.formData()).get('confirm') ?? '')
			.trim()
			.toLowerCase();
		if (typed !== username) return fail(400, { deleteError: 'confirm' as const });

		const { eventIds } = await closeAccount(locals.db, user.id);
		// Sent now, while the GM's address still exists; a failure is left to the sweeper.
		const handlers = handlersFor(platform?.env);
		for (const id of eventIds) {
			await dispatchEvent(locals.db, handlers, id).catch((e: unknown) =>
				locals.log.error('account deletion: dispatch failed', { error: e, eventId: id })
			);
		}
		await anonymiseProfile(locals.db, user.id);
		await deleteAuthUser(admin, user.id);
		await locals.supabase?.auth.signOut();
		locals.log.info('account deleted', { tables: eventIds.length });

		redirect(303, '/');
	}
};
