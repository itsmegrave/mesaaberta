import { imageUrl } from '$lib/server/images';
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

	return {
		// gmId stays on the server: the page only needs the GM's name.
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		tables: tables.map(({ gmId, imagePath, ...table }) => ({
			...table,
			imageUrl: imageUrl(imagePath)
		})),
		systems: systems.map(({ name, slug }) => ({ name, slug })),
		selected
	};
};
