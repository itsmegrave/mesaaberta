import path from 'node:path';

/** Single source of truth for Paraglide, shared by the Vite plugin and scripts/i18n.ts. */
export const paraglideOptions = {
  project: path.join(import.meta.dirname, 'project.inlang'),
  outdir: path.join(import.meta.dirname, 'src/lib/paraglide'),
  emitTsDeclarations: true,
  // Language preferences never change a resource's URL. Only pt-BR is served today.
  strategy: ['cookie', 'baseLocale'],
  // Matches SvelteKit's default for canonical links.
  trailingSlash: 'never',
} as const;
