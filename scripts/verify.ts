// `bun run verify`: checks what a branch changed, not the whole repository. Prettier and ESLint run
// on the changed files, the typecheck runs unless only Markdown changed, and Vitest runs the specs
// the change can reach plus every spec that reads files from disk. `--all` (`bun run verify:all`)
// runs the full lint, typecheck and unit tests instead.
//
//   bun scripts/verify.ts [--base <ref>] [--all] [--lint] [--tests]
//
// --base   what to compare with. Default: where this branch left origin/main, plus everything
//          uncommitted and untracked.
// --lint   only Prettier and ESLint. --tests: only the unit tests. CI uses these, one job each.
//
// It falls back to the full run whenever a narrower one could miss something:
// - the tooling changed (GLOBAL below): config, the lockfile, `.gitignore`, and CSS, which the
//   Tailwind ESLint rules read to judge every component;
// - there is no merge base with origin/main to compare with (a shallow clone, no remote);
// - for the unit tests, a changed file is not a module Vitest can follow through imports (JSON
//   messages, SQL, styles).
// Specs that read sources from disk instead of importing them (the boundary, delivery-graph and
// logged-fields guards) are found with `git grep` and always run.
import { existsSync } from 'node:fs';
import path from 'node:path';

export const GLOBAL =
  /^(package\.json|bun\.lock|bunfig\.toml|eslint\.config\.js|prettier\.config\.js|\.prettierignore|\.editorconfig|.*tsconfig[^/]*\.json|.*vite\.config\.ts|.*svelte\.config\.js|scripts\/verify\.ts)$|(^|\/)(package\.json|\.gitignore)$|\.css$/;
const MODULE = /\.(ts|js|svelte)$/;
const DOCS = /\.md$/;
const READS_DISK = 'readdirSync|readFileSync|readdir\\(|readFile\\(';

export type Run = { ok: boolean; out: string };
export type Step = { label: string; cmd: string[]; cwd: string };

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

/** Where this branch left origin/main, or null when that cannot be told (no remote, a shallow clone). */
export function defaultBase(root: string): string | null {
  const base = run(['git', 'merge-base', 'HEAD', 'origin/main'], root);
  return base.ok ? base.out.trim() : null;
}

/** NUL-separated names from a git command. A failing command throws: an empty list would pass. */
function gitNames(root: string, cmd: string[]): string[] {
  const result = run(cmd, root);
  if (!result.ok) throw new Error(`${cmd.join(' ')} failed:\n${result.out.trim()}`);
  return result.out.split('\0').filter(Boolean);
}

/** Every path that differs from `base`, committed or not, deleted ones included. */
export function changedSince(root: string, base: string): string[] {
  return [
    ...new Set([
      ...gitNames(root, ['git', 'diff', '--no-renames', '--name-only', '-z', base]),
      ...gitNames(root, ['git', 'ls-files', '--others', '--exclude-standard', '-z']),
    ]),
  ];
}

/** Unit specs that read files from disk, which `vitest --changed` cannot connect to a change. */
export function specsReadingDisk(root: string): string[] {
  const found = run(
    ['git', 'grep', '-l', '-z', '-E', READS_DISK, '--', '*.spec.ts', '*.spec.js'],
    root,
  );
  // git grep exits 1 when nothing matches.
  if (!found.ok && found.out.trim() !== '') throw new Error(`git grep failed:\n${found.out}`);
  return found.out
    .split('\0')
    .filter((file) => file && !file.includes('.integration.') && !file.includes('/e2e/'));
}

export const bin = (root: string, name: string) => path.join(root, 'node_modules/.bin', name);
export const touchesTooling = (files: string[]) => files.some((file) => GLOBAL.test(file));
export const modules = (files: string[]) => files.filter((file) => MODULE.test(file));

export type Options = {
  root: string;
  /** null when there is nothing to compare with. */
  base: string | null;
  changed: string[];
  /** The changed paths that still exist. */
  existing: string[];
  diskSpecs: string[];
  all?: boolean;
  lint?: boolean;
  tests?: boolean;
};

/** The steps to run, and why. Pure, so the rules can be tested without running anything. */
export function plan(options: Options): { reason: string; steps: Step[] } {
  const { root, base, changed, existing, diskSpecs } = options;
  const both = !options.lint && !options.tests;
  const lint = both || Boolean(options.lint);
  const tests = both || Boolean(options.tests);
  const web = path.join(root, 'apps/web');
  const steps: Step[] = [];

  const fullReason = options.all
    ? '--all'
    : base === null
      ? 'no merge base with origin/main to compare with; pass --base <ref> for a narrower run'
      : touchesTooling(changed)
        ? 'the tooling changed'
        : null;

  if (fullReason) {
    if (lint) steps.push({ label: 'Lint', cmd: ['bun', 'run', 'lint'], cwd: root });
    if (both) steps.push({ label: 'Typecheck', cmd: ['bun', 'run', 'check'], cwd: root });
    if (tests) steps.push({ label: 'Unit tests', cmd: ['bun', 'run', 'test:unit'], cwd: root });
    return { reason: `Checking everything (${fullReason}).`, steps };
  }

  if (lint && existing.length > 0) {
    steps.push({
      label: 'Prettier',
      cmd: [bin(root, 'prettier'), '--check', '--ignore-unknown', ...existing],
      cwd: root,
    });
    const code = modules(existing);
    if (code.length > 0)
      steps.push({
        label: 'ESLint',
        cmd: [bin(root, 'eslint'), '--no-warn-ignored', ...code],
        cwd: root,
      });
  }
  // Messages, wrangler.jsonc and the inlang settings feed generated types: only Markdown is safe.
  if (both && changed.some((file) => !DOCS.test(file)))
    steps.push({ label: 'Typecheck', cmd: ['bun', 'run', 'check'], cwd: root });
  if (tests && changed.length > 0) {
    const followable = changed.every((file) => MODULE.test(file) || DOCS.test(file));
    const vitest = [
      'bun',
      'run',
      '--bun',
      'vitest',
      'run',
      '--project',
      'client',
      '--project',
      'server',
    ];
    if (!followable)
      steps.push({
        label: 'Unit tests (all: a data or style file changed)',
        cmd: ['bun', 'run', 'test:unit'],
        cwd: root,
      });
    else {
      steps.push({
        label: 'Unit tests (reached by the change)',
        cmd: [...vitest, '--changed', base as string],
        cwd: web,
      });
      if (diskSpecs.length > 0)
        steps.push({
          label: 'Unit tests (specs that read files from disk)',
          // Absolute: Vitest matches filters against paths relative to apps/web.
          cmd: [...vitest, ...diskSpecs.map((file) => path.join(root, file))],
          cwd: web,
        });
    }
  }
  return {
    reason: `Checking ${changed.length} changed file(s) against ${(base as string).slice(0, 12)}.`,
    steps,
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(name);
  const root = repoRoot(process.cwd());
  if (!root) throw new Error('Not inside a git checkout.');

  const at = args.indexOf('--base');
  if (at >= 0 && (!args[at + 1] || args[at + 1].startsWith('--')))
    throw new Error('--base needs a ref, such as --base origin/main.');
  const base = at >= 0 ? args[at + 1] : defaultBase(root);
  const changed = base === null ? [] : changedSince(root, base);
  const { reason, steps } = plan({
    root,
    base,
    changed,
    existing: changed.filter((file) => existsSync(path.join(root, file))),
    diskSpecs: specsReadingDisk(root),
    all: flag('--all'),
    lint: flag('--lint'),
    tests: flag('--tests'),
  });

  console.log(reason);
  if (steps.length === 0) console.log('Nothing to check.');
  for (const { label, cmd, cwd } of steps) {
    console.log(`\n== ${label}`);
    if (!run(cmd, cwd, true).ok) {
      console.error(`\n${label} failed.`);
      process.exit(1);
    }
  }
}
