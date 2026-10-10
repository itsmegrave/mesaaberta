import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The event-delivery graph (handlers + sweeper) is what moves to `packages/core` and `apps/worker`
 * (Trello #120). It must not depend on SvelteKit, the UI's message catalogue or `$app`/`$env`.
 * Remove an entry from `KNOWN` when the step that removes that edge lands.
 */
const ROOTS = ['src/lib/server/events/handlers.ts', 'src/lib/server/events/sweeper.ts'];
const FORBIDDEN = /^(\$app|\$env|@sveltejs\/|\$lib\/paraglide|@sentry\/sveltekit)/;
/** Edges still to remove, as `file -> specifier`. Empty: the graph is clean. */
const KNOWN = new Set<string>();

const resolve = (from: string, spec: string) => {
  const base = spec.startsWith('$lib/')
    ? join('src/lib', spec.slice(5))
    : spec.startsWith('.')
      ? normalize(join(dirname(from), spec))
      : null;
  if (!base) return null;
  return [base, `${base}.ts`, join(base, 'index.ts')].find(
    (candidate) => candidate.endsWith('.ts') && existsSync(candidate),
  );
};

function walk() {
  const seen = new Set<string>();
  const violations = new Set<string>();
  const stack = [...ROOTS];
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(
      /(import\s+type\b[^'"]*|(?:from|import)\s*\(?\s*)['"]([^'"]+)['"]/g,
    )) {
      // A type-only import is erased at build time, so it adds no runtime dependency.
      if (match[1].startsWith('import type')) continue;
      const spec = match[2];
      if (FORBIDDEN.test(spec)) violations.add(`${file} -> ${spec}`);
      const next = resolve(file, spec);
      if (next) stack.push(next);
    }
  }
  return { seen, violations };
}

describe('event delivery graph', () => {
  it('reaches no SvelteKit, $app, $env or message-catalogue import beyond the known ones', () => {
    const { violations } = walk();
    expect([...violations].filter((edge) => !KNOWN.has(edge))).toEqual([]);
  });

  it('does not keep a KNOWN entry the graph no longer has', () => {
    const { violations } = walk();
    expect([...KNOWN].filter((edge) => !violations.has(edge))).toEqual([]);
  });
});
