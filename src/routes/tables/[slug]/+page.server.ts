import { error } from '@sveltejs/kit';
import { can } from '$lib/server/auth/policy';
import { imageUrl, supabaseUrlOf } from '$lib/server/images';
import { findTableBySlug } from '$lib/server/tables/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, platform }) => {
	// Unknown, disabled, or no database at all: the same translated 404.
	const found = locals.db && (await findTableBySlug(locals.db, params.slug, new Date()));
	if (!found) error(404, 'Not found');

	// The GM and admins get an edit link. The policy decides, and the edit page checks it again.
	const { gmId, imagePath, ...table } = found;
	const profile = await locals.getProfile().catch(() => null);

	return {
		table: { ...table, imageUrl: imageUrl(supabaseUrlOf(platform?.env), imagePath) },
		canEdit: can(profile, 'table:edit', { gmId })
	};
};
