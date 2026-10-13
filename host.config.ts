import adapter from '@sveltejs/adapter-cloudflare';

/**
 * The only build-time module that names the host, the counterpart of `src/lib/server/runtime.ts`.
 * A deployment on another host replaces this file (and `runtime.ts`); `vite.config.ts` does not
 * change.
 */
export const hostAdapter = () => adapter();

/** What `sentrySvelteKit` needs to know about the adapter's output. */
export const hostSentry = {
  adapter: 'cloudflare' as const,
  // adapter-cloudflare only writes the client assets to `.svelte-kit/cloudflare`: the server code
  // stays in `.svelte-kit/output/server` until Wrangler bundles it on deploy. Sentry's default
  // (the adapter directory) would upload the client maps only, leaving server stack traces
  // unmapped.
  sourcemapAssets: ['.svelte-kit/cloudflare/**', '.svelte-kit/output/server/**'],
};
