import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const authEnabled = locals.supabase !== null;

	try {
		const profile = await locals.getProfile();

		return {
			authEnabled,
			account: profile && { displayName: profile.displayName, avatarUrl: profile.avatarUrl }
		};
	} catch (error) {
		// The page is still worth showing without the account menu.
		locals.log.error('layout: could not load the profile', { error });
		return { authEnabled, account: null };
	}
};
