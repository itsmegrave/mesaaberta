import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-cloudflare';

/** `HOST=bun` builds a Bun server (Docker, self-hosting); anything else is Cloudflare Workers. */
const bun = process.env.HOST === 'bun';

// Loaded only for a Bun build, and by a name the type checker cannot follow: the package's types
// pull Bun's globals (`Bun`, a `fetch` with `preconnect`) into the whole project, where the Worker
// code is checked against the Workers types.
const bunAdapterPackage = '@sveltejs/adapter-bun';
const adapterBun = bun ? (await import(bunAdapterPackage)).default : undefined;

/**
 * The only build-time module that names the host, the counterpart of `src/lib/server/host`. A
 * deployment on another host adds a module there and chooses it here; `vite.config.ts` does not
 * change.
 */
export const hostAdapter = () =>
  bun
    ? adapterBun!({ out: 'build' })
    : adapter({
        // The Wrangler config stays at the repository root, where a deployment's pipeline finds it.
        config: '../../wrangler.jsonc',
        platformProxy: { configPath: '../../wrangler.jsonc' },
      });

/**
 * The module `#host` resolves to: Cloudflare's bindings, or the Bun/Node ones when `HOST=bun` and in
 * the unit tests (they run on Node, where `cloudflare:workers` does not exist).
 */
export const hostBindingsPath = fileURLToPath(
  new URL(
    bun || process.env.VITEST
      ? './src/lib/server/host/bun.ts'
      : './src/lib/server/host/cloudflare.ts',
    import.meta.url,
  ),
);

/** What `sentrySvelteKit` needs to know about the adapter's output. */
export const hostSentry = bun
  ? { adapter: 'node' as const, sourcemapAssets: undefined }
  : {
      adapter: 'cloudflare' as const,
      // adapter-cloudflare only writes the client assets to `.svelte-kit/cloudflare`: the server code
      // stays in `.svelte-kit/output/server` until Wrangler bundles it on deploy. Sentry's default
      // (the adapter directory) would upload the client maps only, leaving server stack traces
      // unmapped.
      sourcemapAssets: ['.svelte-kit/cloudflare/**', '.svelte-kit/output/server/**'],
    };
