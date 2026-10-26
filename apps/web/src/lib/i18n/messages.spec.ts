import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = join(process.cwd(), 'messages');
const baseLocale = 'pt-BR';

// A message is a string, or a list of variants (plural forms) with the text of each in `match`.
type Variant = { declarations?: string[]; selectors?: string[]; match: Record<string, string> };
type Message = string | Variant[];
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
  const messages = load(locale);

  it('has no empty message', () => {
    for (const key of messageKeys(messages)) {
      for (const text of texts(messages[key])) expect(text.trim(), key).not.toBe('');
    }
  });

  // ICU syntax isn't read by plugin-message-format: it would show up as raw text.
  it('writes plurals as variants, not ICU', () => {
    for (const key of messageKeys(messages)) {
      for (const text of texts(messages[key])) {
        expect(text, key).not.toMatch(/\{\w+,\s*(plural|select|selectordinal)\s*,/);
      }
    }
  });

  it('matches every variant on a declared input, with a catch-all', () => {
    for (const key of messageKeys(messages)) {
      const message = messages[key];
      if (typeof message === 'string') continue;
      for (const variant of message) {
        const selectors = variant.selectors ?? [];
        for (const selector of selectors) {
          expect(variant.declarations, key).toContain(`input ${selector}`);
        }
        for (const condition of Object.keys(variant.match)) {
          expect(selectors, key).toContain(condition.split('=')[0]);
        }
        expect(Object.keys(variant.match), key).toContainEqual(expect.stringMatching(/=\*$/));
      }
    }
  });
});

// The gender-neutral copy rule: quem mestra, quem joga, Participantes.
describe('pt-BR copy', () => {
  const messages = load(baseLocale);
  // "Mestre" alone may stay (#103); the article, a "Mestre:" label or "jogador" marks gender.
  const gendered =
    /\b(?:o|os|do|dos|ao|aos|pelo|pelos|um|uns|seu|seus)\s+mestres?\b|\bmestres?:|\bjogador(?:a|es|as)?\b/i;

  it('uses gender-neutral roles', () => {
    for (const key of messageKeys(messages)) {
      expect(texts(messages[key]).join(' '), key).not.toMatch(gendered);
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
      expect(all(translation[key]).sort(), key).toEqual(all(base[key]).sort());
    }
  });
});
