import { eq } from 'drizzle-orm';
import { profiles } from '$lib/server/db/schema';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const authEnabled = locals.supabase !== null;
	const user = await locals.getUser();
	if (!user || !locals.db) return { authEnabled, account: null };

	try {
		const [account] = await locals.db
			.select({ displayName: profiles.displayName, avatarUrl: profiles.avatarUrl })
			.from(profiles)
			.where(eq(profiles.id, user.id));

		return { authEnabled, account: account ?? null };
	} catch (error) {
		// The page is still worth showing without the account menu.
		locals.log.error('layout: could not load the profile', { error });
		return { authEnabled, account: null };
	}
};
