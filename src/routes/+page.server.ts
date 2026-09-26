import { imageUrl, supabaseUrlOf } from '$lib/server/images';
import { listUpcomingTables } from '$lib/server/tables/queries';
import type { PageServerLoad } from './$types';

// The home page previews the next few tables; the full list lives at /tables.
const PREVIEW_COUNT = 3;

export const load: PageServerLoad = async ({ locals, platform }) => {
	// No database yet (see the README): the page still renders, with nothing to list.
	if (!locals.db) return { tables: [] };

	try {
		const tables = await listUpcomingTables(locals.db, new Date());

		return {
			// gmId stays on the server: the page only needs the GM's name.
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			tables: tables.slice(0, PREVIEW_COUNT).map(({ gmId, imagePath, ...table }) => ({
				...table,
				imageUrl: imageUrl(supabaseUrlOf(platform?.env), imagePath)
			}))
		};
	} catch (error) {
		// The landing page is still worth showing without the preview.
		locals.log.error('home: could not list upcoming tables', { error });
		return { tables: [] };
	}
};
