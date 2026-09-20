import { describe, expect, it } from 'vitest';
import {
	MAX_USERNAME_LENGTH,
	MIN_USERNAME_LENGTH,
	RESERVED_USERNAMES,
	normalizeUsername,
	suggestUsername,
	usernameProblem
} from './username';

describe('normalizeUsername', () => {
	it('trims and lowercases, so `Ana ` and `ana` are the same username', () => {
		expect(normalizeUsername('  Ana-Maria ')).toBe('ana-maria');
	});
});

describe('usernameProblem', () => {
	it.each(['ana', 'ana-maria', 'mestre-42', '007', 'a1b', 'x'.repeat(MAX_USERNAME_LENGTH)])(
		'accepts %j',
		(username) => {
			expect(usernameProblem(username)).toBeNull();
		}
	);

	it('accepts capital letters, which are stored lowercase', () => {
		expect(usernameProblem('Ana')).toBeNull();
	});

	it.each([
		['', 'required'],
		['   ', 'required'],
		['a'.repeat(MIN_USERNAME_LENGTH - 1), 'too_short'],
		['x'.repeat(MAX_USERNAME_LENGTH + 1), 'too_long'],
		['ana maria', 'invalid_chars'],
		['ana_maria', 'invalid_chars'],
		['ana.maria', 'invalid_chars'],
		['ação', 'invalid_chars'],
		['ana@maria', 'invalid_chars'],
		['ana/maria', 'invalid_chars'],
		['🎲🎲🎲', 'invalid_chars'],
		['-ana', 'hyphen_edges'],
		['ana-', 'hyphen_edges'],
		['ana--maria', 'hyphen_double'],
		['admin', 'reserved'],
		['ADMIN', 'reserved'],
		['tables', 'reserved'],
		['mesas', 'reserved'],
		['perfil', 'reserved']
	])('refuses %j as %s', (username, problem) => {
		expect(usernameProblem(username)).toBe(problem);
	});

	it('reserves every top-level route of the site, so a profile URL can never be shadowed', () => {
		for (const route of [
			'admin',
			'api',
			'login',
			'logout',
			'signup',
			'account',
			'auth',
			'tables',
			'onboarding',
			'healthz',
			'forgot-password',
			'reset-password',
			'images'
		]) {
			expect(RESERVED_USERNAMES.has(route), route).toBe(true);
		}
	});

	it('keeps the reserved words themselves valid usernames otherwise, so the list is the only reason', () => {
		for (const word of RESERVED_USERNAMES) {
			expect(word, word).toBe(normalizeUsername(word));
			// Anything shorter than the minimum is refused for its length, not for being reserved.
			if (word.length >= MIN_USERNAME_LENGTH && !word.includes('--')) {
				expect(usernameProblem(word), word).toBe('reserved');
			}
		}
	});
});

describe('suggestUsername', () => {
	it.each([
		['Ana Maria', 'ana-maria'],
		['João da Silva', 'joao-da-silva'],
		['  Mestre  do Dragão!! ', 'mestre-do-dragao']
	])('turns %j into %j', (text, username) => {
		expect(suggestUsername(text)).toBe(username);
	});

	it('cuts a long name to the limit without leaving a hyphen at the end', () => {
		const suggestion = suggestUsername('a'.repeat(MAX_USERNAME_LENGTH - 1) + ' bbb')!;

		expect(suggestion.length).toBeLessThanOrEqual(MAX_USERNAME_LENGTH);
		expect(usernameProblem(suggestion)).toBeNull();
	});

	it.each(['', '🎲🎲', 'ab', 'Admin'])('gives nothing for %j, which would not be accepted', (text) => {
		expect(suggestUsername(text)).toBeNull();
	});
});
