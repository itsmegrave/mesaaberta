import { imageUrl, supabaseUrlOf } from '$lib/server/images';
import { listSystems } from '$lib/server/systems';
import { listUpcomingTables } from '$lib/server/tables/queries';
import type { PageServerLoad } from './$types';

// Systems shown as chips next to "Todos os sistemas"; the rest wait behind "Mais sistemas".
const FEATURED_SYSTEMS = 3;

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	const selected = url.searchParams.get('system') || null;
	// No database yet (see the README): the page still renders, with nothing to list.
	if (!locals.db) return { tables: [], systems: [], featured: [], selected };

	const [upcoming, systems] = await Promise.all([
		listUpcomingTables(locals.db, new Date()),
		listSystems(locals.db)
	]);

	// Systems with the most upcoming tables come first, then the catalogue order.
	const counts = new Map<string, number>();
	for (const table of upcoming) {
		counts.set(table.system.slug, (counts.get(table.system.slug) ?? 0) + 1);
	}
	const ranked = systems
		.map(({ name, slug }, position) => ({ name, slug, count: counts.get(slug) ?? 0, position }))
		.sort((a, b) => b.count - a.count || a.position - b.position)
		.map(({ name, slug }) => ({ name, slug }));

	// A system picked from the overflow list stays visible as a chip, so the filter shows what is on.
	const featured = ranked.slice(0, FEATURED_SYSTEMS);
	const picked = ranked.find((system) => system.slug === selected);
	if (picked && !featured.includes(picked)) featured.push(picked);

	const tables = selected ? upcoming.filter((table) => table.system.slug === selected) : upcoming;

	return {
		// gmId stays on the server: the page only needs the GM's name.
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		tables: tables.map(({ gmId, imagePath, ...table }) => ({
			...table,
			imageUrl: imageUrl(supabaseUrlOf(platform?.env), imagePath)
		})),
		systems: ranked,
		featured,
		selected
	};
};
