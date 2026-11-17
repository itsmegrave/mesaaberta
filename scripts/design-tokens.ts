// Writes design/tokens.json, the design system's tokens as the app paints them (Trello #269),
// from the Cerberus theme, Tailwind's theme and apps/web/src/routes/layout.css, through the map in
// apps/web/src/lib/theme/tokens.ts. Usage: bun scripts/design-tokens.ts. A unit spec fails while
// the committed file is stale. Then ask Claude Code to re-sync the design system from GitHub.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { designTokens, type CssSources } from '../apps/web/src/lib/theme/design-tokens.ts';

const root = join(import.meta.dirname, '..');
const web = createRequire(join(root, 'apps/web/package.json'));

export const OUTPUT = join(root, 'design/tokens.json');

export const META = {
  repo: 'itsmegrave/mesaaberta',
  paths: {
    tokens: [
      'apps/web/src/lib/theme/tokens.ts',
      'apps/web/src/routes/layout.css',
      '@skeletonlabs/skeleton/themes/cerberus',
      'tailwindcss/theme.css',
    ],
  },
};

export const readSources = (): CssSources => ({
  cerberus: readFileSync(
    join(dirname(web.resolve('@skeletonlabs/skeleton/package.json')), 'src/themes/cerberus.css'),
    'utf8',
  ),
  tailwindTheme: readFileSync(web.resolve('tailwindcss/theme.css'), 'utf8'),
  layout: readFileSync(join(root, 'apps/web/src/routes/layout.css'), 'utf8'),
});

export const render = () => `${JSON.stringify(designTokens(readSources(), META), null, 2)}\n`;

if (import.meta.main) {
  writeFileSync(OUTPUT, render());
  console.log(`Wrote ${OUTPUT}`);
}
