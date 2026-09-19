# Contributing

Thanks for helping. Bug reports, fixes, features and translations are all welcome.

## Workflow

- One issue, one small pull request that closes it.
- Conventional commits, one concern per commit.
- The PR should build green (`pnpm lint`, `pnpm check`, `pnpm test`) and include a short test plan.
- Tests describe behavior, not wording. Each test should name the break it catches.

See the [README](README.md) for setup and scripts.

## Translations

The site is written in Brazilian Portuguese (`pt-BR`, the base language) and English. All user-facing text lives in `messages/<locale>.json`, one flat file per language, so translating never touches components.

**Fix or improve a translation:** edit the value in `messages/<locale>.json`. Keep the keys and any `{placeholders}` exactly as they are.

**Add a language** (for example `es`):

1. Copy `messages/pt-BR.json` to `messages/es.json` and translate every value.
2. Add `"es"` to `locales` in `project.inlang/settings.json`.
3. Add its name in that language to `localeNames` in `src/lib/i18n/locales.ts`. TypeScript reports an error until you do.
4. Run `pnpm test`. A test fails if your file is missing a key or changes a placeholder.

English lives at `/en`, and the base language at `/`. A new language gets its own prefix the same way (`/es`).

Proper nouns (Mesa Aberta, Lenindragons, GitHub) stay as they are. Each language is named in itself in the switcher: "Português", "English".

## Internal links

Link to pages with `localizedHref(path, getLocale())` from `$lib/i18n/locales`, so a reader in English stays in English.
