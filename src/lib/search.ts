/** Text as a search compares it: without accents and case, so "tormenta" finds "Tormenta 20". */
export const foldForSearch = (text: string) =>
	text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.trim();

/** Whether `name` contains what was typed, ignoring accents and case. An empty query matches all. */
export const matchesSearch = (name: string, query: string) =>
	foldForSearch(name).includes(foldForSearch(query));
