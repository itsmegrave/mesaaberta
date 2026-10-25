import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `src/lib/components` holds only shared components: ones used by more than one route section, by
 * the root layout, or by other shared code. A component that only one page or one section uses
 * (everything under `/admin`, say) lives beside it, in that route's `components/` folder.
 */
const WEB = resolve(import.meta.dirname, '../../..');
const LIB = join(WEB, 'src/lib/components');
const ROUTES = join(WEB, 'src/routes');
const SKIP = new Set(['node_modules', '.svelte-kit', 'paraglide']);

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|js|svelte)$/.test(entry.name) ? [path] : [];
  });

const specifiers = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+\.svelte)['"]/g)].map(
    (match) => match[1],
  );

/** The file a specifier points at, for `#lib`/`$lib` aliases and relative paths. */
const target = (file: string, spec: string) => {
  if (spec.startsWith('#lib/') || spec.startsWith('$lib/'))
    return join(WEB, 'src/lib', spec.slice(5));
  if (spec.startsWith('.')) return resolve(dirname(file), spec);
  return null;
};

describe('the shared components folder', () => {
  it('holds only components used by more than one route section', () => {
    const files = sources(join(WEB, 'src'));
    const users = new Map<string, Set<string>>();
    for (const file of files) {
      for (const spec of specifiers(file)) {
        const to = target(file, spec);
        if (!to || dirname(to) !== LIB) continue;
        const name = basename(to, '.svelte');
        // A component's own specs and harness do not make it shared.
        if (basename(file).startsWith(name + '.') || basename(file) === `${name}Harness.svelte`)
          continue;
        users.set(to, (users.get(to) ?? new Set()).add(file));
      }
    }

    const misplaced = readdirSync(LIB)
      .filter((name) => name.endsWith('.svelte') && !name.endsWith('Harness.svelte'))
      .map((name) => join(LIB, name))
      .filter((component) => {
        const by = [...(users.get(component) ?? [])];
        if (by.length === 0) return false;
        if (by.some((file) => !file.startsWith(ROUTES + '/'))) return false;
        // All its users are routes: shared only when they span more than one section.
        const sections = new Set(by.map((file) => relative(ROUTES, dirname(file)).split('/')[0]));
        return sections.size === 1 && [...sections][0] !== '';
      })
      .map((component) => relative(WEB, component));

    expect(misplaced, 'move these next to the route that uses them').toEqual([]);
  });
});
