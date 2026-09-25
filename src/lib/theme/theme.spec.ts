import { describe, expect, it } from 'vitest';
import { resolveMode } from './theme';

describe('resolveMode', () => {
	it.each([
		['light', true, 'light'],
		['light', false, 'light'],
		['dark', true, 'dark'],
		['dark', false, 'dark']
	] as const)('a chosen %s wins over the system (dark: %s)', (choice, prefersDark, mode) => {
		expect(resolveMode(choice, prefersDark)).toBe(mode);
	});

	it('follows the system when nothing was chosen', () => {
		expect(resolveMode('system', true)).toBe('dark');
		expect(resolveMode('system', false)).toBe('light');
	});
});
