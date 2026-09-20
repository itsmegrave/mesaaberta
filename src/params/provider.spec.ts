import { describe, expect, it } from 'vitest';
import { match } from './provider';

describe('provider param matcher', () => {
	it.each(['google', 'discord'])('accepts %s', (provider) => {
		expect(match(provider)).toBe(true);
	});

	// Only what is set up in Supabase is offered. (Supabase calls Meta "facebook", if it is added back.)
	it.each(['github', 'apple', 'facebook', 'meta', 'Google', ''])('rejects %j', (provider) => {
		expect(match(provider)).toBe(false);
	});
});
