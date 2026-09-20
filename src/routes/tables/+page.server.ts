import { listSystems } from '$lib/server/systems';
import { listUpcomingTables } from '$lib/server/tables/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const selected = url.searchParams.get('system') || null;
	// No database yet (see the README): the page still renders, with nothing to list.
	if (!locals.db) return { tables: [], systems: [], selected };

	const [tables, systems] = await Promise.all([
		listUpcomingTables(locals.db, new Date(), { systemSlug: selected ?? undefined }),
		listSystems(locals.db)
	]);

	return { tables, systems: systems.map(({ name, slug }) => ({ name, slug })), selected };
};
