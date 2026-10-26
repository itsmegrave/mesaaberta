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
        // Tests use isolated ephemeral state; sharing Wrangler's SQLite with E2E causes SQLITE_BUSY.
        platformProxy: {
          configPath: '../../wrangler.jsonc',
          ...(process.env.VITEST ? { persist: false } : {}),
        },
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
  ? { adapter: 'node' as const, sourcemapAssets: undefined, sourcemapIgnore: undefined }
  : {
      adapter: 'cloudflare' as const,
      // Only the browser's files. Wrangler bundles the server code (`.svelte-kit/output/server` and
      // the `_worker.js` entry) into one `_worker.js` on deploy, so Vite's server maps never match a
      // server frame, and their debug ids would all claim that one file. The deploy uploads the
      // Wrangler bundle's own map instead, under the release and dist `sentryReleaseFor` sets.
      sourcemapAssets: ['.svelte-kit/cloudflare/**'],
      sourcemapIgnore: ['**/node_modules/**', '.svelte-kit/cloudflare/_worker.js*'],
    };
