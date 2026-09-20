import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import { handleTableForm } from '$lib/server/tables/form-action';
import { createTable } from '$lib/server/tables/write';
import { listSystems } from '$lib/server/systems';
import { NEW_TABLE_VALUES } from '$lib/tables/form-values';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requireUser(locals, url);
	if (!locals.db) error(503, 'Database not configured');

	const systems = await listSystems(locals.db);

	return {
		values: NEW_TABLE_VALUES,
		systems: systems.map(({ name, slug }) => ({ name, slug }))
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { locals } = event;
		// Who is asking comes before whether we can serve them.
		await requireUser(locals, event.url);
		if (!locals.db) error(503, 'Database not configured');
		const db = locals.db;

		return handleTableForm(event, async (input, imagePath) =>
			createTable(db, await locals.getProfile(), input, { imagePath })
		);
	}
};
