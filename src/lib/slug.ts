import baseSlugify from '@sindresorhus/slugify';

export const MAX_SLUG_LENGTH = 60;

// The site is in Brazilian Portuguese, so a spaced `&` reads as "e" ("Dungeons & Dragons" becomes
// `dungeons-e-dragons`). Umlauts lose their marks (`Mörk` becomes `mork`, not the German `moerk`).
const replacements: [string, string][] = [
	['&', 'e'],
	['ö', 'o'],
	['ä', 'a'],
	['ü', 'u']
];

const trimDashes = (slug: string) => slug.replace(/^-+|-+$/g, '');

/**
 * URL-safe slug: lowercase letters, digits and single dashes, at most 60 characters. Accents are
 * stripped. An `&` between two words becomes "e"; one glued to letters is dropped, so `D&D` is
 * `dd` and `3D&T` is `3dt` instead of `de-d` and `3-de-t`. If nothing usable is left (an
 * emoji-only title), `fallback` is used, so the result is never empty.
 */
export function slugify(text: string, { fallback = 'item' }: { fallback?: string } = {}): string {
	const slug = baseSlugify(text.replace(/(?<=\S)&(?=\S)/g, ''), {
		customReplacements: replacements,
		// Do not split at case changes: `3DT` and `MonsterHearts` stay one word, as displayed.
		decamelize: false
	});

	return trimDashes(slug.slice(0, MAX_SLUG_LENGTH)) || fallback;
}

/**
 * The first free slug: `base`, then `base-2`, `base-3`, ... The suffix is made to fit inside the
 * length cap. `isTaken` is only a first guess: the unique index in the database decides, so a
 * caller that inserts must still retry when two requests pick the same slug at once.
 */
export function nextFreeSlug(base: string, isTaken: (slug: string) => boolean): string {
	if (!isTaken(base)) return base;

	for (let n = 2; ; n++) {
		const suffix = `-${n}`;
		const candidate = trimDashes(base.slice(0, MAX_SLUG_LENGTH - suffix.length)) + suffix;
		if (!isTaken(candidate)) return candidate;
	}
}
