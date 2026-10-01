import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import tailwindcss from 'eslint-plugin-tailwindcss';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

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
    // Access decisions live in one module. Reading a role anywhere else means a route or module is
    // deciding access itself: ask `can()` or `authorize()` from `$lib/server/auth/policy` instead.
    files: ['src/**/*.{ts,svelte}'],
    ignores: ['src/lib/server/auth/policy.ts', 'src/**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='role']",
          message: 'Do not read a role to decide access. Use can() or authorize() from the policy.',
        },
      ],
    },
  },
);
