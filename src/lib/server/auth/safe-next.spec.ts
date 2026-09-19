import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
	it.each(['/', '/tables', '/tables/mesa-do-dragao', '/tables?page=2', '/tables#top'])(
		'keeps the on-site path %s',
		(path) => {
			expect(safeNext(path)).toBe(path);
		}
	);

	it.each([
		['another site', 'https://evil.example/'],
		['a protocol-relative URL', '//evil.example'],
		['a backslash trick', '/\\evil.example'],
		['a tab-smuggled protocol-relative URL', '/\t/evil.example'],
		['a javascript: URL', 'javascript:alert(1)'],
		['a relative path without a leading slash', 'tables'],
		['an empty string', ''],
		['nothing', null]
	])('falls back to the home page for %s', (_name, value) => {
		expect(safeNext(value)).toBe('/');
	});

	it('uses the fallback it is given', () => {
		expect(safeNext('https://evil.example', '/account')).toBe('/account');
	});
});
