import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOGGED_FIELDS } from '../observability/privacy';

/**
 * The logger drops any field outside the privacy allowlist without a word, so a line written with
 * `{ closed: 3 }` reached Sentry with no count at all. This reads every log call in the public code
 * and fails on a field the allowlist would drop: add the field to `privacy.ts` deliberately, or
 * name it with a field that is already there.
 */
const REPO = resolve(import.meta.dirname, '../../../..');
const SKIP = new Set(['node_modules', '.svelte-kit', '.git', 'dist', '.wrangler', 'build', 'e2e']);

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|svelte)$/.test(entry.name) && !/\.spec\.ts$/.test(entry.name) ? [path] : [];
  });

// `log.warn('area.event', { ... })`, `locals.log.info(...)`, `log[level]('request.completed', {`.
const CALL =
  /\b(?:log|logger|locals\.log|[a-zA-Z]+Log)(?:\.(?:debug|info|warn|error)|\[[^\]]+\])\(\s*'[^']*',\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
// The keys of an object literal's top level: `key:`, a shorthand `key,` and never a spread.
const keysOf = (body: string) =>
  body
    .replace(/\{[^{}]*\}/g, '{}')
    .replace(/\([^()]*\)/g, '()')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith('...') && !part.startsWith('//'))
    .map((part) => /^([A-Za-z_$][\w$]*)\s*(?::|$)/.exec(part)?.[1])
    .filter((key): key is string => !!key);

describe('log fields', () => {
  it('uses only fields the privacy allowlist keeps', () => {
    const dropped = ['apps', 'packages']
      .flatMap((root) => sources(join(REPO, root)))
      .flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(CALL)].flatMap((match) =>
          keysOf(match[1])
            .filter((key) => !LOGGED_FIELDS.has(key))
            .map((key) => `${relative(REPO, file)}: ${key}`),
        ),
      );
    expect(dropped).toEqual([]);
  });
});
