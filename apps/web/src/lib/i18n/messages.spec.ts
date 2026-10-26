import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, type Token } from '@messageformat/parser';
import { describe, expect, it } from 'vitest';

const dir = join(process.cwd(), 'messages');
const baseLocale = 'pt-BR';

// Every message is an ICU MessageFormat string (plurals included), read by @inlang/plugin-icu1.
const load = (locale: string): Record<string, string> =>
  JSON.parse(readFileSync(join(dir, `${locale}.json`), 'utf8'));

const messageKeys = (messages: Record<string, string>) =>
  Object.keys(messages)
    .filter((key) => !key.startsWith('$'))
    .sort();

// Rejects broken syntax and plural keys the locale doesn't have (`few` in pt-BR, say).
const tokens = (locale: string, text: string) =>
  parse(text, { cardinal: new Intl.PluralRules(locale).resolvedOptions().pluralCategories });

// The arguments a message reads, so `{count}` and `#` count as the same placeholder.
const placeholders = (list: Token[], plural?: string): string[] =>
  list.flatMap((token) => {
    if (token.type === 'argument' || token.type === 'function') return [token.arg];
    if (token.type === 'octothorpe') return plural ? [plural] : [];
    if (token.type === 'content') return [];
    return [token.arg, ...token.cases.flatMap((c) => placeholders(c.tokens, token.arg))];
  });

// Plain text of every branch, for the copy checks below.
const texts = (list: Token[]): string[] =>
  list.flatMap((token) => {
    if (token.type === 'content') return [token.value];
    if (token.type === 'plural' || token.type === 'select' || token.type === 'selectordinal')
      return token.cases.flatMap((c) => texts(c.tokens));
    return [];
  });

const locales = readdirSync(dir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''));

describe.each(locales)('%s messages', (locale) => {
  const messages = load(locale);

  it('has no empty message', () => {
    for (const key of messageKeys(messages)) expect(messages[key].trim(), key).not.toBe('');
  });

  it('is valid ICU MessageFormat', () => {
    for (const key of messageKeys(messages)) {
      expect(typeof messages[key], key).toBe('string');
      expect(() => tokens(locale, messages[key]), key).not.toThrow();
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
      const copy = texts(tokens(baseLocale, messages[key])).join(' ');
      expect(copy, key).not.toMatch(gendered);
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
    const all = (loc: string, text: string | undefined) =>
      [...new Set(placeholders(tokens(loc, text ?? '')))].sort();
    for (const key of messageKeys(base)) {
      expect(all(locale, translation[key]), key).toEqual(all(baseLocale, base[key]));
    }
  });
});
