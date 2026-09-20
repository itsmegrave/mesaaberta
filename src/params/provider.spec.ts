import { describe, expect, it } from 'vitest';
import { match } from './provider';

describe('provider param matcher', () => {
	it.each(['google', 'apple', 'facebook', 'discord'])('accepts %s', (provider) => {
		expect(match(provider)).toBe(true);
	});

	// Supabase calls Meta "facebook", so that is the route segment. GitHub is not offered.
	it.each(['github', 'meta', 'Google', ''])('rejects %j', (provider) => {
		expect(match(provider)).toBe(false);
	});
});
