import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { builtinModules } from 'node:module';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import tailwindcss from 'eslint-plugin-tailwindcss';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

// Reading a role anywhere but the policy means a route or module is deciding access itself.
const roleRead = {
  selector: "MemberExpression[property.name='role']",
  message: 'Do not read a role to decide access. Use can() or authorize() from the policy.',
};
// `platform` is Cloudflare's shape. Reading it outside the runtime module ties that code to one host.
const hostEnvRead = {
  selector:
    "MemberExpression[property.name=/^(env|ctx|caches|cf)$/]:matches([object.name='platform'], [object.property.name='platform'])",
  message:
    'Do not read platform.env, .ctx, .caches or .cf. Read locals.env and locals.host, which handleRuntime fills from the host.',
};

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
      // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      'no-undef': 'off',
      // Leaving a field out with a rest sibling ({ gmId, ...table }) is the point, and `_name` marks an unused one.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
      },
    },
  },
  {
    files: ['**/*.{ts,js,svelte}'],
    plugins: { tailwindcss },
    settings: {
      tailwindcss: {
        attributes: ['class'],
        cssConfigPath: './src/routes/layout.css',
      },
    },
    rules: {
      // Prettier's Tailwind plugin owns class ordering; its output is more reliable for arbitrary values.
      'tailwindcss/classnames-order': 'off',
      'tailwindcss/enforces-canonical-classname': 'error',
      'tailwindcss/enforces-negative-arbitrary-values': 'error',
      'tailwindcss/enforces-shorthand': 'error',
      'tailwindcss/important-modifier-suffix': 'error',
      'tailwindcss/no-custom-classname': [
        'error',
        { whitelist: ['legal', 'table-top', 'rich-text'] },
      ],
      'tailwindcss/no-contradicting-classname': 'error',
      // The v4 plugin currently rewrites valid fractional line-heights to invalid dynamic utilities.
      'tailwindcss/no-unnecessary-arbitrary-value': 'off',
    },
  },
  {
    // Shared packages must build on workerd as well as the self-host runtime, so they name no host:
    // Cloudflare lives in the apps' entry files and in the adapter modules listed below.
    files: ['packages/**/*.{ts,js}'],
    // Specs run under Vitest on Node and are never bundled for a runtime.
    ignores: ['packages/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: builtinModules.filter((name) => !name.startsWith('node:')),
          patterns: [
            'node:*',
            'bun',
            'bun:*',
            'cloudflare:*',
            '@cloudflare/*',
            '@sentry/cloudflare',
            '@sveltejs/adapter-cloudflare',
            'wrangler',
            '$app/*',
            '$env/*',
          ],
        },
      ],
      'no-restricted-globals': ['error', 'Bun', 'process', 'Buffer', '__dirname', '__filename'],
    },
  },
  {
    // Two rules share `no-restricted-syntax`, so each block below lists the ones that apply to it.
    files: ['src/**/*.{ts,svelte}'],
    ignores: ['src/**/*.spec.ts'],
    rules: { 'no-restricted-syntax': ['error', roleRead, hostEnvRead] },
  },
  // Access decisions live in one module, which is where a role is read.
  {
    files: ['src/lib/server/auth/policy.ts'],
    rules: { 'no-restricted-syntax': ['error', hostEnvRead] },
  },
  // The host's variables and bindings are read in one module, which fills `locals.env`.
  {
    files: ['src/lib/server/runtime.ts'],
    rules: { 'no-restricted-syntax': ['error', roleRead] },
  },
);
