import { slugify } from '$lib/slug';

// The username is the person's public identifier and slug: lowercase letters, digits and single
// hyphens. One module for the browser and the server, so the form and the action cannot disagree.
// The database repeats the format in a check constraint and enforces uniqueness with an index.

export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 30;

/** Why a username is refused, as a short code the UI turns into a message. */
export type UsernameProblem =
	| 'required'
	| 'too_short'
	| 'too_long'
	| 'invalid_chars'
	| 'hyphen_edges'
	| 'hyphen_double'
	| 'reserved';

/**
 * Words nobody may take: the site's top-level routes (a profile URL must never be shadowed by a
 * page), plus names that would pass for the site or its staff. Add a route here when adding one.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
	// Routes.
	'account',
	'admin',
	'api',
	'auth',
	'forgot-password',
	'healthz',
	'images',
	'login',
	'logout',
	'onboarding',
	'reset-password',
	'signup',
	'tables',
	// Words a profile URL or a page could want later, in both languages.
	'about',
	'ajuda',
	'assets',
	'busca',
	'conta',
	'contato',
	'dashboard',
	'edit',
	'explore',
	'help',
	'home',
	'jogador',
	'jogadores',
	'mesa',
	'mesas',
	'new',
	'perfil',
	'privacidade',
	'privacy',
	'profile',
	'profiles',
	'register',
	'search',
	'settings',
	'sistema',
	'sistemas',
	'static',
	'suporte',
	'support',
	'system',
	'systems',
	'table',
	'termos',
	'terms',
	'user',
	'users',
	'usuario',
	'usuarios',
	// Names that would pass for the site or its staff.
	'administrador',
	'anonymous',
	'mesa-aberta',
	'mesaaberta',
	'moderador',
	'moderator',
	'null',
	'staff',
	'undefined'
]);

/** How a username is stored and compared: trimmed, lowercase. */
export const normalizeUsername = (value: string): string => value.trim().toLowerCase();

/** The problem with this username, or null if it is acceptable. Capital letters are fine: they are stored lowercase. */
export function usernameProblem(value: string): UsernameProblem | null {
	const username = normalizeUsername(value);

	if (username === '') return 'required';
	if (username.length < MIN_USERNAME_LENGTH) return 'too_short';
	if (username.length > MAX_USERNAME_LENGTH) return 'too_long';
	if (!/^[a-z0-9-]+$/.test(username)) return 'invalid_chars';
	if (username.startsWith('-') || username.endsWith('-')) return 'hyphen_edges';
	if (username.includes('--')) return 'hyphen_double';
	if (RESERVED_USERNAMES.has(username)) return 'reserved';

	return null;
}

/** A username made from a name (accents stripped, spaces to hyphens), or null if nothing acceptable comes out. */
export function suggestUsername(text: string): string | null {
	const suggestion = slugify(text, { fallback: '' })
		.slice(0, MAX_USERNAME_LENGTH)
		.replace(/-+$/, '');

	return usernameProblem(suggestion) === null ? suggestion : null;
}
