import { can } from '$lib/server/auth/policy';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const authEnabled = locals.supabase !== null;
	// The Mesas link appears once the platform is released. The pages exist before that, unlinked.
	const released = await locals.flags.isEnabled('is_platform_released');

	try {
		const profile = await locals.getProfile();

		return {
			authEnabled,
			released,
			account: profile && {
				displayName: profile.name ?? profile.username ?? 'Pessoa sem nome',
				avatarUrl: profile.avatarUrl,
				isAdmin: can(profile, 'admin:access'),
				pendingSuggestionsCount: 0
			}
		};
	} catch (error) {
		// The page is still worth showing without the account menu.
		locals.log.error('layout: could not load the profile', { error });
		return { authEnabled, released, account: null };
	}
};
