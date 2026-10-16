import { existsSync } from 'node:fs';
import { sentrySvelteKit } from '@sentry/sveltekit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { paraglideOptions } from './paraglide.config.ts';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import tailwindcss from '@tailwindcss/vite';
import {
  hostAdapter,
  hostBindingsPath,
  hostBundlesDependencies,
  hostSentry,
} from './host.config.ts';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  // `#host` is the one place the web app names its host (see host.config.ts).
  resolve: { alias: { '#host': hostBindingsPath } },
  // A Worker has no node_modules at run time: Wrangler bundles the server output, and cannot load the
  // `.svelte` files of Svelte libraries (Skeleton, TanStack) that Vite left as imports. SvelteKit 3
  // no longer bundles dependencies for SSR on its own, so say so. (adapter-bun sets its own.)
  ssr: hostBundlesDependencies ? { noExternal: true } : undefined,
  plugins: [
    sentrySvelteKit({
      // Source maps go to the project named by SENTRY_ORG and SENTRY_PROJECT.
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      adapter: hostSentry.adapter,
      telemetry: false,
      autoInstrument: false,
      autoUploadSourceMaps:
        !!process.env.SENTRY_AUTH_TOKEN || existsSync('.env.sentry-build-plugin'),
      sourcemaps: {
        assets: hostSentry.sourcemapAssets,
      },
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
          'form-action': ['self', 'https://www.instagram.com'],
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
          include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
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
            // Beside the web app: the shared packages and the other two apps (this config's
            // root is apps/web, so they sit one level up).
            '../../packages/**/*.{test,spec}.{js,ts}',
            '../api/**/*.{test,spec}.{js,ts}',
            '../worker/**/*.{test,spec}.{js,ts}',
          ],
          exclude: [
            'src/**/*.svelte.{test,spec}.{js,ts}',
            'src/**/*.integration.spec.ts',
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
          include: ['src/**/*.integration.spec.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          // One file at a time: they share the database.
          fileParallelism: false,
        },
      },
    ],
  },
});
