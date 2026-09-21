import { describe, expect, it } from 'vitest';
import { NEW_TABLE_VALUES } from './form-values';
import { DEFAULT_WELCOME_MESSAGE } from './welcome';

describe('NEW_TABLE_VALUES', () => {
	it('starts every new table with the default welcome message', () => {
		expect(NEW_TABLE_VALUES.welcomeMessage).toBe(DEFAULT_WELCOME_MESSAGE);
	});
});
