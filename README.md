# Mesa Aberta

A scheduler for tabletop RPG tables: game masters open tables, players sign up, everyone gets a calendar invite. Planned home: mesaaberta.app (deployment is tracked in [#3](https://github.com/itsmegrave/mesaaberta/issues/3)).

The roadmap and architecture decisions live in [issue #1](https://github.com/itsmegrave/mesaaberta/issues/1).

## Stack

SvelteKit (Svelte 5, TypeScript) · Tailwind CSS · Paraglide (i18n) · Vitest · Playwright · pnpm · Node 26

## Getting started

Requirements: Node and pnpm at the versions in `.tool-versions` and `packageManager` in `package.json`.

```sh
pnpm install
pnpm exec playwright install chromium   # component and e2e tests run in a real browser
pnpm dev
```

## Scripts

| Script           | What it does                                                                      |
| ---------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`       | Dev server                                                                        |
| `pnpm build`     | Production build                                                                  |
| `pnpm lint`      | Prettier check and ESLint                                                         |
| `pnpm format`    | Prettier write                                                                    |
| `pnpm i18n`      | Compile `messages/*.json` into `src/lib/paraglide` (run by `prepare` and `check`) |
| `pnpm check`     | Type-check `.ts` and `.svelte` files                                              |
| `pnpm test:unit` | Vitest: component tests (Chromium) and unit tests (Node)                          |
| `pnpm test:e2e`  | Playwright against a production build, on mobile and desktop                      |
| `pnpm test`      | Unit tests, then e2e                                                              |

## Project layout

```
src/routes/   pages and layouts
src/lib/      shared code, imported through $lib
e2e/          Playwright tests (*.e2e.ts)
```

Component tests sit next to the code as `*.svelte.spec.ts`; plain unit tests as `*.spec.ts`.

## Feature flags

Flags come from [GrowthBook](https://www.growthbook.io). To add one:

1. Add it to `flagDefaults` in `src/lib/server/flags/registry.ts` with a safe default (`false` hides unfinished work). That value is used whenever GrowthBook cannot answer.
2. Create a feature with the same key in GrowthBook.
3. Read it in server code: `await locals.flags.isEnabled('my_flag')`.

Flags load lazily, only when something reads one, and the payload is cached for 60 seconds. The GrowthBook client key in `wrangler.jsonc` is public by design: it can only read flags. Without those settings, for example under plain `vite dev`, every flag returns its default.

## TypeScript 7

TypeScript 7 no longer exposes the compiler API that `svelte-check` and `typescript-eslint` are built on. Both run side by side:

- `typescript` 6 is used by ESLint.
- `@typescript/native` (TypeScript 7) type-checks through `svelte-check --tsgo`.

Drop the TS 6 copy once both tools support TS 7 natively.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), including how to fix a message or add a language.

- One issue, one small PR, closing the issue.
- Conventional commits, one concern per commit.
- Every PR builds green and includes a short test plan.
- Test behaviour, not wording: each test should name the break it catches.
