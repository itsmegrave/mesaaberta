/** Single source of truth for Paraglide, shared by the Vite plugin and scripts/i18n.ts. */
export const paraglideOptions = {
	project: './project.inlang',
	outdir: './src/lib/paraglide',
	emitTsDeclarations: true,
	// Locale comes from the URL only: pt-BR at `/`, English under `/en`. No locale cookie.
	strategy: ['url', 'baseLocale'],
	// Matches SvelteKit's default, so `/en` is canonical and `/en/` is not linked.
	trailingSlash: 'never'
} as const;
