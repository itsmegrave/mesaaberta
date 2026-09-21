import { describe, expect, it } from 'vitest';
import { NETWORKS, isNetwork, parseSocialUrl } from './social-links';

describe('parseSocialUrl', () => {
	it.each([
		['https://instagram.com/ana', 'https://instagram.com/ana'],
		['http://example.com/a?b=1', 'http://example.com/a?b=1'],
		['  https://example.com/ana  ', 'https://example.com/ana'],
		// Typed without a scheme: what people paste from an address bar.
		['instagram.com/ana', 'https://instagram.com/ana'],
		['www.example.com', 'https://www.example.com/']
	])('accepts %j as %j', (raw, url) => {
		expect(parseSocialUrl(raw)).toBe(url);
	});

	it.each([
		'',
		'   ',
		'javascript:alert(1)',
		'JavaScript:alert(1)',
		'data:text/html,<script>alert(1)</script>',
		'ftp://example.com',
		'https://user:secret@example.com',
		'https://',
		'not a url',
		'https://exa mple.com',
		'//example.com',
		`https://example.com/${'a'.repeat(300)}`
	])('refuses %j', (raw) => {
		expect(parseSocialUrl(raw)).toBeNull();
	});
});

describe('networks', () => {
	it('knows the networks and a generic website', () => {
		expect(NETWORKS).toContain('instagram');
		expect(NETWORKS).toContain('website');
		expect(isNetwork('instagram')).toBe(true);
		expect(isNetwork('myspace')).toBe(false);
	});
});
