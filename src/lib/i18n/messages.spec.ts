import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(process.cwd(), 'messages');
const baseLocale = 'pt-BR';

const load = (locale: string): Record<string, string> =>
	JSON.parse(readFileSync(join(dir, `${locale}.json`), 'utf8'));

const messageKeys = (messages: Record<string, string>) =>
	Object.keys(messages)
		.filter((key) => !key.startsWith('$'))
		.sort();

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const locales = readdirSync(dir)
	.filter((file) => file.endsWith('.json'))
	.map((file) => file.replace(/\.json$/, ''));

describe.each(locales)('%s messages', (locale) => {
	it('has no empty message', () => {
		const messages = load(locale);

		for (const key of messageKeys(messages)) expect(messages[key].trim(), key).not.toBe('');
	});
});

// Vacuous while pt-BR is the only language; it starts checking the day a translation is added.
describe.each(locales.filter((locale) => locale !== baseLocale))('%s translation', (locale) => {
	const base = load(baseLocale);
	const translation = load(locale);

	it('has exactly the keys of the base locale', () => {
		expect(messageKeys(translation)).toEqual(messageKeys(base));
	});

	it('uses the same placeholders as the base locale in every message', () => {
		for (const key of messageKeys(base)) {
			expect(placeholders(translation[key] ?? ''), key).toEqual(placeholders(base[key]));
		}
	});
});
