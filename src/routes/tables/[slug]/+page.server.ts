import { error } from '@sveltejs/kit';
import { findTableBySlug } from '$lib/server/tables/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	// Unknown, disabled, or no database at all: the same translated 404.
	const table = locals.db && (await findTableBySlug(locals.db, params.slug, new Date()));
	if (!table) error(404, 'Not found');

	return { table };
};
