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
	.map((file) => file.replace(/\.json$/, ''))
	.filter((locale) => locale !== baseLocale);

describe.each(locales)('%s translation', (locale) => {
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
