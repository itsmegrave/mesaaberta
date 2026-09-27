import { error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { requireUser } from '$lib/server/auth/guard';
import { handleTableForm } from '$lib/server/tables/form-action';
import { dispatchEvent } from '$lib/server/events/dispatcher';
import { handlersFor } from '$lib/server/events/handlers';
import { createTable } from '$lib/server/tables/write';
import { TABLE_CREATION_LIMIT, checkRateLimit } from '$lib/server/rate-limit';
import { listSystems } from '$lib/server/systems';
import { NEW_TABLE_VALUES } from '$lib/tables/form-values';
import { tableFormSchema } from '$lib/tables/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requireUser(locals, url);
	if (!locals.db) error(503, 'Database not configured');

	const systems = await listSystems(locals.db);

	return {
		form: await superValidate(NEW_TABLE_VALUES, zod4(tableFormSchema), { errors: false }),
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

		return handleTableForm(
			event,
			async (input, imagePath) => {
				const created = await createTable(db, await locals.getProfile(), input, { imagePath });
				// After the commit and the response, so the visitor never waits for a handler.
				locals.afterResponse((db) =>
					dispatchEvent(db, handlersFor(event.platform?.env), created.eventId)
				);
				return created;
			},
			// A limited person is told before their image is stored. `createTable` checks again, under a lock.
			async () => {
				const actor = await locals.getProfile();
				if (actor) await checkRateLimit(db, actor.id, TABLE_CREATION_LIMIT);
			}
		);
	}
};
