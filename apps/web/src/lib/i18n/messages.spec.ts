import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(process.cwd(), 'messages');
const baseLocale = 'pt-BR';

// A message is a string, or a list of variants (plural forms) with the text of each in `match`.
type Message = string | { match: Record<string, string> }[];
const load = (locale: string): Record<string, Message> =>
  JSON.parse(readFileSync(join(dir, `${locale}.json`), 'utf8'));
const texts = (message: Message | undefined) =>
  typeof message === 'string' || message === undefined
    ? [message ?? '']
    : message.flatMap((variant) => Object.values(variant.match));

const messageKeys = (messages: Record<string, Message>) =>
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

    for (const key of messageKeys(messages)) {
      for (const text of texts(messages[key])) expect(text.trim(), key).not.toBe('');
    }
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
      const all = (message: Message | undefined) => [
        ...new Set(texts(message).flatMap((text) => placeholders(text))),
      ];
      expect(all(translation[key]), key).toEqual(all(base[key]));
    }
  });
});
