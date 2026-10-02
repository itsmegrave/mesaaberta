# Contributing

Thanks for helping. Bug reports, fixes, features and translations are all welcome.

## Workflow

- One issue, one small pull request that closes it.
- Conventional commits, one concern per commit.
- Publish user-facing release notes in the [Canny changelog](https://mesaaberta.canny.io/changelog).
- The PR should build green (`pnpm lint`, `pnpm check`, `pnpm test`; and `pnpm test:integration` when you touch anything that depends on database concurrency, see the README) and include a short test plan.
- Tests describe behavior, not wording. Each test should name the break it catches.

See the [README](README.md) for setup and scripts.

## Code style

Tabs for indentation and semicolons at the end of statements (YAML is the one exception and uses spaces). Prettier is the only formatter: `prettier.config.js` sets the rules and `.editorconfig` tells editors the same. ESLint checks code quality and never formatting.

- `pnpm format` rewrites every file to the style.
- `pnpm lint:fix` does the same and applies ESLint's automatic fixes.
- `pnpm lint` (Prettier check, then ESLint) is what CI runs, and a badly formatted file fails it.

In VS Code, install the recommended extensions when prompted (`.vscode/extensions.json`) and files are formatted on save. Any other editor needs the Prettier plugin and EditorConfig support.

When you must disable an ESLint rule, say why on the same line: `// eslint-disable-next-line rule -- reason`.

## UI and forms

Prefer Skeleton primitives and the shared `Form`, `FormField`, `TextInput` and `SubmitButton` components. Use the shared `Button`, `TextArea` and `SelectInput` for the remaining basic controls. Basic controls use semantic HTML inside their wrappers because Skeleton does not provide standalone Button, TextInput or Form components. Use theme tokens and Tailwind's 4px spacing grid; document calculated layout exceptions.

New form migrations use TanStack Form for values/validation and TanStack Query for mutations/cache. The catalog, approval queue and notification actions are migrated flows. `src/lib/forms/action-form.svelte.ts` supplies a single submit handler, validation errors, pending/delayed/timeout states and failure-safe drafts. Pass the affected cache domain explicitly for Query-backed reads; route-only data such as notifications reloads through SvelteKit. Pair it with `Form` and the existing SvelteKit action; do not add a second enhancement handler or automatic write retries. Server authorization and Zod validation remain authoritative.

`validateStringForm` handles only allowlisted scalar text fields. Arrays, numbers, booleans and files need explicit domain decoders before using it in other flows. Never allowlist passwords or files for echoing in action responses. Use `validateFormData` with explicit defaults and array/boolean/file fields for compound forms. Strip files with `responseForm` and passwords with `withoutSecrets` before returning any action response.

Multiline text a person writes for others to read (a table's description, the welcome message, an announcement) uses `RichTextField` and is shown with `RichText`. It is stored as the small HTML subset of `src/lib/text/rich.ts` (paragraphs, headings, bold, italic, underline, strikethrough, lists, quotes, code, dividers and http/https/mailto links; no images, colours or alignment, because the CSP blocks inline `style`). Validate it with `richText(max)` from `$lib/text/rich-schema`, whose limit counts what a reader sees, and show it only through `RichText`, the one place `{@html}` is allowed. Calendar, Instagram and the plain-text e-mail copy use `toPlainText`. Chat messages and rating comments use the plain-text `TextArea` wrapper.

Review migrated controls for accessibility and mobile/desktop and light/dark visual coverage. Approval retains a native POST fallback; catalog dialogs still require JavaScript.

## Icons

Icons come from [Iconify](https://iconify.design) as one Svelte component per icon, following the [SVG + CSS for Svelte](https://iconify.design/docs/usage/svg-css/svelte/) docs: Lucide (`@iconify-svelte/lucide`) and Game Icons (`@iconify-svelte/game-icons`). Use them by name: `<Icon name="wrench" />` (`$lib/components/Icon.svelte`).

To add one, import it in `src/lib/icons/registry.ts` and add it to `ICONS` ([browse Lucide](https://icon-sets.iconify.design/lucide/), [Game Icons](https://icon-sets.iconify.design/game-icons/)). Game Icons names carry the `game-icons:` prefix. Loading states use the shared `Spinner` (`svg-spinners:tadpole`), with reduced-motion support. Run `pnpm icons` after changing the registry or upgrading icon packages. It embeds their SVG geometry so rendering works without CSS path support or external requests.

## Translations

The site is written in Brazilian Portuguese (`pt-BR`, the base language), and only that language is served today. All user-facing text lives in `messages/<locale>.json`, one flat file per language, so translating never touches components. English is planned in [#31](https://github.com/itsmegrave/mesaaberta/issues/31).

**Fix a message:** edit its value in `messages/pt-BR.json`. Keep the keys and any `{placeholders}` exactly as they are.

**Add a language** (for example `en`):

1. Copy `messages/pt-BR.json` to `messages/en.json` and translate every value.
2. Add `"en"` to `locales` in `project.inlang/settings.json`.
3. Run `pnpm test`. A test fails if your file is missing a key or changes a placeholder.
4. There is no language switch yet, because only one language is served. It ships with the second language (see #31).

A new language is served under its own prefix (`/en`), and pt-BR stays at `/`. Proper nouns (Mesa Aberta, Lenindragons, GitHub) stay as they are.

## Internal links

Link to pages with `localizedHref(path, getLocale())` from `$lib/i18n/locales`, so a reader in English stays in English.
