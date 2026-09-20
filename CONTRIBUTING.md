# Contributing

Thanks for helping. Bug reports, fixes, features and translations are all welcome.

## Workflow

- One issue, one small pull request that closes it.
- Conventional commits, one concern per commit.
- The PR should build green (`pnpm lint`, `pnpm check`, `pnpm test`; and `pnpm test:integration` when you touch anything that depends on database concurrency, see the README) and include a short test plan.
- Tests describe behavior, not wording. Each test should name the break it catches.

See the [README](README.md) for setup and scripts.

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
