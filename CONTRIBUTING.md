# Contributing

Thanks for helping. Bug reports, fixes, features and translations are all welcome.

## Workflow

- One issue, one small pull request that closes it.
- Conventional commits, one concern per commit.
- A user-facing feature or bug fix adds a [changelog entry](#changelog).
- The PR should build green (`pnpm lint`, `pnpm check`, `pnpm test`; and `pnpm test:integration` when you touch anything that depends on database concurrency, see the README) and include a short test plan.
- Tests describe behavior, not wording. Each test should name the break it catches.

See the [README](README.md) for setup and scripts.

## Changelog

Every pull request that ships a new feature or fixes a bug people can notice adds an entry to the changelog at [/changelog](https://mesaaberta.app/changelog). Chores (`chore:` commits), admin-only changes, refactors, tests, tooling and dependency bumps don't.

Add one Markdown file to `src/content/changelog/`, named `YYYY-MM-DD-short-name.md` after the release day:

```md
---
date: 2026-10-06
title: Busca por sistema de jogo
---

Uma frase opcional sobre a mudança.

## Adicionado

- Filtro por sistema na lista de mesas.

## Corrigido

- O convite de calendário agora usa o fuso de quem joga.
```

- Write for players and GMs, in pt-BR, about what changed for them, not how the code changed.
- Sections are optional, but only `## Adicionado`, `## Alterado` and `## Corrigido` are allowed. Anything else fails the tests.
- `draft: true` shows the entry only in `pnpm dev` and to admins, marked "Rascunho", for an entry that shouldn't go out yet. Remove it when the change is released.
- Several changes going out the same day share one entry.
- Run `pnpm changelog` after adding or editing an entry, and commit `src/lib/changelog/entries.generated.ts` with it. The Cron Trigger's Worker reads the entries from that module; a test fails while it is out of date.
- Once deployed, a published entry is announced in everyone's notification bell on the next cron run (within minutes): its title and opening sentence, linking to it on the page. That happens once per entry, only for entries dated in the last 30 days, and never for drafts. Write the opening sentence so it stands on its own.

## Code style

Tabs for indentation and semicolons at the end of statements (YAML is the one exception and uses spaces). Prettier is the only formatter: `prettier.config.js` sets the rules and `.editorconfig` tells editors the same. ESLint checks code quality and never formatting.

- `pnpm format` rewrites every file to the style.
- `pnpm lint:fix` does the same and applies ESLint's automatic fixes.
- `pnpm lint` (Prettier check, then ESLint) is what CI runs, and a badly formatted file fails it.

In VS Code, install the recommended extensions when prompted (`.vscode/extensions.json`) and files are formatted on save. Any other editor needs the Prettier plugin and EditorConfig support.

When you must disable an ESLint rule, say why on the same line: `// eslint-disable-next-line rule -- reason`.

## UI and forms

Prefer Skeleton primitives and the shared `Form`, `FormField`, `TextInput` and `SubmitButton` components. Basic controls use semantic HTML inside their wrappers because Skeleton does not provide standalone Button, TextInput or Form components. Use theme tokens and Tailwind's 4px spacing grid; document calculated layout exceptions.

New form migrations use TanStack Form for values/validation and TanStack Query for mutations/cache. The catalog and approval queue are the first migrated flows. `src/lib/forms/action-form.svelte.ts` supplies a single submit handler, validation errors, pending/delayed/timeout states and failure-safe drafts. Pass the affected cache domain explicitly. Pair it with `Form` and the existing SvelteKit action; do not add a second enhancement handler or automatic write retries. Server authorization and Zod validation remain authoritative.

`validateStringForm` handles only allowlisted scalar text fields. Arrays, numbers, booleans and files need explicit domain decoders before using it in other flows. Never allowlist passwords or files for echoing in action responses. Existing Superforms consumers remain transitional until card #152 is complete.

Run `node scripts/ui-inventory.ts` after a migration to generate the local, untracked `docs/ui-migration-inventory.md`. Keep generated reports out of the PR. That report identifies markup to review; it does not certify accessibility or mobile/desktop and light/dark visual coverage. Approval retains a native POST fallback; catalog dialogs still require JavaScript.

## Icons

Icons come from [Iconify](https://iconify.design), Lucide set: `<Icon name="wrench" />` (`$lib/components/Icon.svelte`). The drawings are bundled, never fetched (the CSP allows no request to Iconify's API):

1. Add the Lucide name to `src/lib/icons/names.ts` ([browse the set](https://icon-sets.iconify.design/lucide/)).
2. Run `pnpm icons` and commit `src/lib/icons/lucide.generated.ts`. A test fails while it is out of date.

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
