import { fileURLToPath } from 'node:url';
import { sentrySvelteKit } from '@sentry/sveltekit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { paraglideOptions } from './paraglide.config.ts';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import tailwindcss from '@tailwindcss/vite';
import { formActionOrigins } from './src/lib/extensions/origins.ts';
import { hostAdapter, hostBindingsPath, hostSentry } from './host.config.ts';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  // `#host` is the one place the web app names its host (see host.config.ts).
  // `#lib` is also an alias, because the private package's panels (outside this app's own
  // `package.json` imports map) reach the app's components through it.
  resolve: {
    alias: {
      '#host': hostBindingsPath,
      '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  // The Svelte libraries ship `.svelte` files, which only Vite can compile: they must go through it
  // and into the server bundle. (A Worker has no node_modules at run time, and Wrangler cannot load a
  // `.svelte` file.) SvelteKit 3 no longer bundles dependencies for SSR on its own. Not everything:
  // `noExternal: true` pulls CommonJS dependencies in too, and the bundle then needs
  // `createRequire(import.meta.url)`, which Workers do not have. adapter-bun sets its own.
  ssr: {
    noExternal: [/^@iconify-svelte\//, /^@skeletonlabs\//, /^@tanstack\/svelte-/, /^@zag-js\//],
  },
  // The browser's maps, written next to each file without a `sourceMappingURL` comment. The deploy
  // stamps them with debug ids and uploads them with `sentry-cli` (`sourcemaps inject` and
  // `upload`): the plugin's own upload never runs under Vite 8, whose environment builds leave
  // its "is this the server build" check false, so no browser map had ever reached Sentry.
  build: { sourcemap: 'hidden' },
  // The release the browser's events carry (the tag; the deploy sets SENTRY_RELEASE), the same as
  // the server's `sentryReleaseFor`. Empty outside a deploy.
  define: { __SENTRY_RELEASE__: JSON.stringify(process.env.SENTRY_RELEASE ?? '') },
  plugins: [
    sentrySvelteKit({
      adapter: hostSentry.adapter,
      telemetry: false,
      autoInstrument: false,
      autoUploadSourceMaps: false,
    }),
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
      },
      adapter: hostAdapter(),
      // Checks for a new deploy every minute; the root layout offers a refresh without interrupting
      // the visitor's navigation or form entry.
      version: { pollInterval: 60_000 },
      // Nonce mode: SvelteKit adds a fresh nonce to `script-src` and `style-src` for each
      // response and stamps it on the inline scripts it renders. The rest of the security
      // headers live in `src/lib/server/security-headers.ts`.
      csp: {
        mode: 'nonce',
        directives: {
          'default-src': ['self'],
          'script-src': ['self', 'https://static.cloudflareinsights.com'],
          'style-src': ['self'],
          // SvelteKit's own screen-reader announcer (`#svelte-announcer`) has an inline `style`
          // attribute. Only that exact string is allowed, by hash. If a SvelteKit upgrade changes
          // it, e2e/security.e2e.ts reports the blocked style: replace the hash with the new one.
          'style-src-attr': [
            'unsafe-hashes',
            // SvelteKit emits one form while rendering and another while hydrating.
            'sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo=',
            'sha256-/T6DJcdasOV4WsFcyeBnzYHkgGst73FPCnMT1hu8phU=',
            // The combobox's positioner (zag) writes one inline `style` while it hydrates.
            'sha256-N+kfEVeVPD+eevnfyUCbAQjL1CLgCj09L7ASUyzYXAM=',
          ],
          // Profile pictures come from the sign-in providers' CDNs.
          'img-src': [
            'self',
            'data:',
            'https://lh3.googleusercontent.com',
            'https://cdn.discordapp.com',
            // Table images, from the project's Supabase Storage bucket.
            'https://*.supabase.co',
            // The crop step shows the picked file from a blob URL until it is cut and sent.
            'blob:',
            // Files in an S3-compatible store (STORAGE_PROVIDER=s3) are read from its public domain,
            // which the build must know too.
            ...(process.env.STORAGE_PUBLIC_URL
              ? [new URL(process.env.STORAGE_PUBLIC_URL).origin as `https://${string}.${string}`]
              : []),
            // The e2e build adds the local Supabase (see playwright.config.ts). Never set in production.
            ...(process.env.CSP_EXTRA_IMG_SRC
              ? [process.env.CSP_EXTRA_IMG_SRC as `http://${string}.${string}`]
              : []),
          ],
          'font-src': ['self'],
          'connect-src': [
            'self',
            'https://cloudflareinsights.com',
            // Where the browser sends telemetry (Sentry's ingest origin), set by the deployment.
            ...(process.env.CSP_EXTRA_CONNECT_SRC
              ? [process.env.CSP_EXTRA_CONNECT_SRC as `https://${string}.${string}`]
              : []),
          ],
          'object-src': ['none'],
          'base-uri': ['self'],
          'form-action': ['self', ...formActionOrigins],
          'frame-ancestors': ['none'],
        },
      },
    }),
    paraglideVitePlugin({ ...paraglideOptions, strategy: [...paraglideOptions.strategy] }),
  ],
  test: {
    expect: { requireAssertions: true },
    // Limit concurrent PGlite startup under Bun in local and CI runs without relaxing timeouts.
    maxWorkers: 2,
    projects: [
      {
        extends: './vite.config.ts',
        optimizeDeps: {
          // Imported on demand (the emoji picker, the editor), so the scan meets them late and
          // reloads the page mid-run, which fails whichever spec is loading at that moment.
          include: ['emoji-picker-element/picker', '@tiptap/core', '@tiptap/starter-kit', 'xss'],
        },
        test: {
          name: 'client',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium', headless: true }],
          },
          include: [
            'src/**/*.svelte.{test,spec}.{js,ts}',
            '../../packages/privy/**/*.svelte.{test,spec}.{js,ts}',
          ],
          exclude: ['src/lib/server/**'],
        },
      },

      {
        extends: './vite.config.ts',
        test: {
          name: 'server',
          environment: 'node',
          // Svelte libraries ship `.svelte` files, which Node cannot load: Vite must transform them.
          server: { deps: { inline: [/svelte/] } },
          // Tests that start an in-process Postgres (PGlite) take a moment when the machine is busy.
          testTimeout: 20_000,
          hookTimeout: 20_000,
          include: [
            'src/**/*.{test,spec}.{js,ts}',
            // Beside the web app: the shared packages and the other apps (this config's
            // root is apps/web, so they sit one level up).
            '../../packages/**/*.{test,spec}.{js,ts}',
            '../api/**/*.{test,spec}.{js,ts}',
            '../worker/**/*.{test,spec}.{js,ts}',
            '../mcp/**/*.{test,spec}.{js,ts}',
          ],
          exclude: [
            'src/**/*.svelte.{test,spec}.{js,ts}',
            '../../packages/**/*.svelte.{test,spec}.{js,ts}',
            'src/**/*.integration.spec.ts',
            '../../packages/**/*.integration.spec.ts',
            '**/node_modules/**',
            '../../**/node_modules/**',
            '../**/node_modules/**',
          ],
        },
      },

      {
        // Needs a real Postgres (DATABASE_URL): `bun run test:integration`.
        extends: './vite.config.ts',
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.integration.spec.ts', '../../packages/**/*.integration.spec.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          // One file at a time: they share the database.
          fileParallelism: false,
        },
      },
    ],
  },
});
