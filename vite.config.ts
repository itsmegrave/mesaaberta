import { existsSync } from 'node:fs';
import { sentrySvelteKit } from '@sentry/sveltekit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { paraglideOptions } from './paraglide.config.ts';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [
    sentrySvelteKit({
      org: 'mesa-aberta',
      project: 'mesa-aberta-app',
      adapter: 'cloudflare',
      telemetry: false,
      autoInstrument: false,
      autoUploadSourceMaps:
        !!process.env.SENTRY_AUTH_TOKEN || existsSync('.env.sentry-build-plugin'),
      sourcemaps: {
        // adapter-cloudflare only writes the client assets to `.svelte-kit/cloudflare`: the server
        // code stays in `.svelte-kit/output/server` until Wrangler bundles it on deploy. Sentry's
        // default (the adapter directory) would upload the client maps only, leaving server stack
        // traces unmapped.
        assets: ['.svelte-kit/cloudflare/**', '.svelte-kit/output/server/**'],
      },
    }),
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
      },
      adapter: adapter(),
      experimental: {
        instrumentation: { server: true },
      },
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
            'https://o4512176851714048.ingest.us.sentry.io',
            'https://cloudflareinsights.com',
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
    // Concurrent PGlite startup can exceed the hook timeout under Bun on developer machines.
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
          // Tests that start an in-process Postgres (PGlite) take a moment when the machine is busy.
          testTimeout: 20_000,
          hookTimeout: 20_000,
          include: ['src/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/**/*.integration.spec.ts'],
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
