// `bun run verify`: checks what a branch changed, not the whole repository. Prettier and ESLint run
// on the changed files, the typecheck runs when code changed, and Vitest runs the specs the change
// can reach. `--all` (`bun run verify:all`) runs the full lint, typecheck and unit tests instead.
//
//   bun scripts/verify.ts [--base <ref>] [--all] [--lint] [--tests]
//
// --base   what to compare with. Default: where this branch left origin/main, plus everything
//          uncommitted and untracked.
// --lint   only Prettier and ESLint. --tests: only the unit tests. CI uses these, one job each.
//
// The full run still happens whenever a narrower one could miss something: a change to the tooling
// itself (GLOBAL below) runs everything, and the unit tests run in full unless every changed file
// is a module Vitest can follow through imports. Specs that read data from disk (messages, the
// changelog, design tokens) are not reachable that way.
import { existsSync } from 'node:fs';
import path from 'node:path';

const GLOBAL =
  /^(package\.json|bun\.lock|bunfig\.toml|eslint\.config\.js|prettier\.config\.js|\.prettierignore|\.editorconfig|.*tsconfig[^/]*\.json|.*vite\.config\.ts|.*svelte\.config\.js|scripts\/verify\.ts)$|(^|\/)package\.json$/;
const MODULE = /\.(ts|js|svelte)$/;

export type Run = { ok: boolean; out: string };

export function run(cmd: string[], cwd: string, show = false): Run {
  const done = Bun.spawnSync(cmd, {
    cwd,
    stdout: show ? 'inherit' : 'pipe',
    stderr: show ? 'inherit' : 'pipe',
  });
  return {
    ok: done.exitCode === 0,
    out: show ? '' : `${done.stdout.toString()}${done.stderr.toString()}`,
  };
}

export function repoRoot(cwd: string): string | null {
  const top = run(['git', 'rev-parse', '--show-toplevel'], cwd);
  return top.ok ? top.out.trim() : null;
}

/** Where this branch left origin/main, or HEAD when that cannot be told (no remote, a shallow clone). */
export function defaultBase(root: string): string {
  const base = run(['git', 'merge-base', 'HEAD', 'origin/main'], root);
  return base.ok ? base.out.trim() : 'HEAD';
}

/** Every path that differs from `base`, committed or not, deleted ones included. */
export function changedSince(root: string, base: string): string[] {
  const names = (cmd: string[]) => run(cmd, root).out.split('\0').filter(Boolean);
  return [
    ...new Set([
      ...names(['git', 'diff', '--no-renames', '--name-only', '-z', base]),
      ...names(['git', 'ls-files', '--others', '--exclude-standard', '-z']),
    ]),
  ];
}

export const bin = (root: string, name: string) => path.join(root, 'node_modules/.bin', name);
export const present = (root: string, files: string[]) =>
  files.filter((file) => existsSync(path.join(root, file)));
export const touchesTooling = (files: string[]) => files.some((file) => GLOBAL.test(file));
export const modules = (files: string[]) => files.filter((file) => MODULE.test(file));

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(name);
  const root = repoRoot(process.cwd());
  if (!root) throw new Error('Not inside a git checkout.');

  const at = args.indexOf('--base');
  const base = at >= 0 ? args[at + 1] : defaultBase(root);
  const changed = changedSince(root, base);
  const all = flag('--all') || touchesTooling(changed);
  const both = !flag('--lint') && !flag('--tests');
  const steps: [string, string[], string][] = [];

  if (all) {
    const why = flag('--all') ? '--all' : 'the tooling changed';
    console.log(`Checking everything (${why}).`);
    if (both || flag('--lint')) steps.push(['Lint', ['bun', 'run', 'lint'], root]);
    if (both) steps.push(['Typecheck', ['bun', 'run', 'check'], root]);
    if (both || flag('--tests')) steps.push(['Unit tests', ['bun', 'run', 'test:unit'], root]);
  } else {
    const files = present(root, changed);
    const code = modules(files);
    console.log(`Checking ${changed.length} changed file(s) against ${base.slice(0, 12)}.`);
    if ((both || flag('--lint')) && files.length > 0) {
      steps.push([
        'Prettier',
        [bin(root, 'prettier'), '--check', '--ignore-unknown', ...files],
        root,
      ]);
      if (code.length > 0)
        steps.push(['ESLint', [bin(root, 'eslint'), '--no-warn-ignored', ...code], root]);
    }
    if (both && modules(changed).length > 0)
      steps.push(['Typecheck', ['bun', 'run', 'check'], root]);
    if ((both || flag('--tests')) && changed.length > 0) {
      const followable = changed.every((file) => MODULE.test(file) || /\.md$/.test(file));
      steps.push(
        followable
          ? [
              'Unit tests (reached by the change)',
              [
                'bun',
                'run',
                '--bun',
                'vitest',
                'run',
                '--project',
                'client',
                '--project',
                'server',
                '--changed',
                base,
              ],
              path.join(root, 'apps/web'),
            ]
          : ['Unit tests (all: a data or style file changed)', ['bun', 'run', 'test:unit'], root],
      );
    }
  }

  if (steps.length === 0) console.log('Nothing to check.');
  for (const [label, cmd, cwd] of steps) {
    console.log(`\n== ${label}`);
    if (!run(cmd, cwd, true).ok) {
      console.error(`\n${label} failed.`);
      process.exit(1);
    }
  }
}
