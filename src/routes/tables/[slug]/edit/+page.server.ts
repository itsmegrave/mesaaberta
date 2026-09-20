import { error, redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import { Forbidden, NotFound } from '$lib/server/errors';
import { imageUrl, supabaseUrlOf } from '$lib/server/images';
import { handleTableForm } from '$lib/server/tables/form-action';
import { disableTable, loadTableForEdit, updateTable } from '$lib/server/tables/write';
import { listSystems } from '$lib/server/systems';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, params, platform }) => {
	await requireUser(locals, url);
	if (!locals.db) error(503, 'Database not configured');

	try {
		const { slug, status, imagePath, ...values } = await loadTableForEdit(
			locals.db,
			await locals.getProfile(),
			params.slug
		);
		const systems = await listSystems(locals.db);

		return {
			slug,
			status,
			values: {
				...values,
				capacity: String(values.capacity),
				durationMinutes: String(values.durationMinutes)
			},
			imageUrl: imageUrl(supabaseUrlOf(platform?.env), imagePath),
			systems: systems.map(({ name, slug }) => ({ name, slug }))
		};
	} catch (e) {
		// Someone else's table is a 403; one that is not there is a 404.
		if (e instanceof Forbidden) error(403, 'Forbidden');
		if (e instanceof NotFound) error(404, 'Not found');
		throw e;
	}
};

export const actions: Actions = {
	save: async (event) => {
		const { locals, params } = event;
		await requireUser(locals, event.url);
		if (!locals.db) error(503, 'Database not configured');
		const db = locals.db;

		return handleTableForm(event, async (input, imagePath) => {
			await updateTable(db, await locals.getProfile(), params.slug, input, { imagePath });
			return { slug: params.slug };
		});
	},

	disable: async ({ locals, params, url }) => {
		await requireUser(locals, url);
		if (!locals.db) error(503, 'Database not configured');

		try {
			await disableTable(locals.db, await locals.getProfile(), params.slug);
		} catch (e) {
			if (e instanceof Forbidden) error(403, 'Forbidden');
			if (e instanceof NotFound) error(404, 'Not found');
			throw e;
		}

		redirect(303, '/tables');
	}
};
