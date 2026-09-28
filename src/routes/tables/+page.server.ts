import { imageUrl, supabaseUrlOf } from '$lib/server/images';
import { listSystems } from '$lib/server/systems';
import { listCatalog } from '$lib/server/catalog';
import { listUpcomingTables } from '$lib/server/tables/queries';
import type { PageServerLoad } from './$types';

// Tags shown as chips before "Mais tags".
const FEATURED_TAGS = 7;

export const load: PageServerLoad = async ({ locals, url, platform }) => {
	// Every filter comes from the query string, as slugs; a key repeats for each value ticked.
	const pickedSystems = url.searchParams.getAll('system').filter(Boolean);
	const modalityParam = url.searchParams.get('modality');
	const modality =
		modalityParam === 'online' || modalityParam === 'in_person' ? modalityParam : null;
	// Several of each can be ticked: a table matches if it has any of the platforms ticked, and any
	// of the tags ticked.
	const pickedPlatforms = url.searchParams.getAll('platform').filter(Boolean);
	const pickedTags = url.searchParams.getAll('tag').filter(Boolean);
	const empty = { platforms: [], tags: [], moreTags: [] };
	// No database yet (see the README): the page still renders, with nothing to list.
	if (!locals.db) {
		return {
			tables: [],
			systems: [],
			pickedSystems,
			modality,
			catalog: empty,
			pickedPlatforms,
			pickedTags
		};
	}

	const [upcoming, systems, catalog] = await Promise.all([
		listUpcomingTables(locals.db, new Date()),
		listSystems(locals.db),
		listCatalog(locals.db)
	]);

	// Tags in use come first; the rest wait behind "Mais tags", unless one of them is ticked.
	const tagUse = new Map<string, number>();
	for (const table of upcoming) {
		for (const tag of table.tags) tagUse.set(tag.slug, (tagUse.get(tag.slug) ?? 0) + 1);
	}
	const rankedTags = catalog.tags
		.map((tag, position) => ({ ...tag, use: tagUse.get(tag.slug) ?? 0, position }))
		.sort((a, b) => b.use - a.use || a.position - b.position)
		.map(({ name, slug }) => ({ name, slug }));
	const shownTags = rankedTags.filter(
		(tag, i) => i < FEATURED_TAGS || pickedTags.includes(tag.slug)
	);

	// In the dropdown, systems with the most upcoming tables come first, then the catalogue order.
	const counts = new Map<string, number>();
	for (const table of upcoming) {
		counts.set(table.system.slug, (counts.get(table.system.slug) ?? 0) + 1);
	}
	const ranked = systems
		.map(({ name, slug }, position) => ({ name, slug, count: counts.get(slug) ?? 0, position }))
		.sort((a, b) => b.count - a.count || a.position - b.position)
		.map(({ name, slug }) => ({ name, slug }));

	const tables = upcoming.filter(
		(table) =>
			(pickedSystems.length === 0 || pickedSystems.includes(table.system.slug)) &&
			(!modality || table.modality === modality) &&
			(pickedPlatforms.length === 0 ||
				table.platforms.some((p) => pickedPlatforms.includes(p.slug))) &&
			(pickedTags.length === 0 || table.tags.some((t) => pickedTags.includes(t.slug)))
	);

	return {
		// gmId stays on the server: the page only needs the GM's name.
		tables: tables.map(({ gmId, imagePath, ...table }) => ({
			...table,
			imageUrl: imageUrl(supabaseUrlOf(platform?.env), imagePath)
		})),
		systems: ranked,
		pickedSystems,
		modality,
		catalog: {
			platforms: catalog.platforms,
			tags: shownTags,
			moreTags: rankedTags.filter((tag) => !shownTags.includes(tag))
		},
		pickedPlatforms,
		pickedTags
	};
};
