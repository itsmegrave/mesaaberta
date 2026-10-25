import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The private package is injected at one seam (Trello #207-#212): `installed.ts` names it, and a
 * private build replaces that file. Nothing else in the public code may import it, so the open
 * source project builds and runs without it. The package, in turn, reaches the public code only
 * through `@mesaaberta/core`, the way it will once it lives in its own repository.
 */
const REPO = resolve(import.meta.dirname, '../../../../..');
const SKIP = new Set(['node_modules', '.svelte-kit', '.git', 'dist', '.wrangler', 'build']);
/** The files allowed to name the package: the server seam, and the web half of it. */
const SEAMS = new Set([
  'packages/core/src/server/extensions/installed.ts',
  'apps/web/src/lib/extensions/panels.ts',
]);

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|js|svelte)$/.test(entry.name) ? [path] : [];
  });

const specifiers = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  );

describe('the privy package boundary', () => {
  it('is imported only by the seam files, never by the public code', () => {
    const offenders = ['apps', 'packages']
      .flatMap((root) => sources(join(REPO, root)))
      .map((file) => relative(REPO, file))
      .filter((file) => !file.startsWith('packages/privy/') && !SEAMS.has(file))
      .filter((file) => !file.endsWith('.spec.ts'))
      .filter((file) =>
        specifiers(join(REPO, file)).some((spec) => spec.startsWith('@mesaaberta/privy')),
      );
    expect(offenders).toEqual([]);
  });

  it('reaches the public code only through @mesaaberta/core, its own files and, in a panel, the web app #lib', () => {
    const own = join(REPO, 'packages/privy');
    const offenders = sources(own)
      .filter((file) => !file.endsWith('.spec.ts'))
      .flatMap((file) =>
        specifiers(file)
          .filter(
            (spec) =>
              // A panel is the web app's own UI, so only a .svelte file may use its `#lib` alias.
              (/^#/.test(spec) && !(file.endsWith('.svelte') && spec.startsWith('#lib/'))) ||
              /^\$|^@sveltejs\//.test(spec) ||
              (spec.startsWith('.') && !resolve(dirname(file), spec).startsWith(own)),
          )
          .map((spec) => `${relative(REPO, file)} -> ${spec}`),
      );
    expect(offenders).toEqual([]);
  });

  it('keeps the installed extensions out of the code the browser bundles', () => {
    // A private build installs extensions whose server code cannot run in a browser (Instagram's
    // resvg .wasm). The web app's universal files (components, +page.ts, +layout.ts, #lib outside
    // server/) are bundled for the browser too, so they must not import a module that loads the
    // installed list: use observe-load.ts, not observe.ts.
    const loadsInstalled =
      /^@mesaaberta\/core\/server\/extensions(?:\/(?:index|installed|observe))?$/;
    const offenders = sources(join(REPO, 'apps/web/src'))
      .map((file) => relative(REPO, file))
      .filter((file) => !/\.spec\.ts$|\.server\.ts$|\+server\.ts$|\/server\//.test(file))
      .filter((file) => specifiers(join(REPO, file)).some((spec) => loadsInstalled.test(spec)));
    expect(offenders).toEqual([]);
  });
});
