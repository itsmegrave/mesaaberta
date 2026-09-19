# Mesa Aberta

A scheduler for tabletop RPG tables: game masters open tables, players sign up, everyone gets a calendar invite. Planned home: mesaaberta.app (deployment is tracked in [#3](https://github.com/itsmegrave/mesaaberta/issues/3)).

The roadmap and architecture decisions live in [issue #1](https://github.com/itsmegrave/mesaaberta/issues/1).

## Stack

SvelteKit (Svelte 5, TypeScript) · Tailwind CSS · Vitest · Playwright · pnpm · Node 26

## Getting started

Requirements: Node and pnpm at the versions in `.tool-versions` and `packageManager` in `package.json`.

```sh
pnpm install
pnpm exec playwright install chromium   # component and e2e tests run in a real browser
pnpm dev
```

## Scripts

| Script           | What it does                                                 |
| ---------------- | ------------------------------------------------------------ |
| `pnpm dev`       | Dev server                                                   |
| `pnpm build`     | Production build                                             |
| `pnpm lint`      | Prettier check and ESLint                                    |
| `pnpm format`    | Prettier write                                               |
| `pnpm check`     | Type-check `.ts` and `.svelte` files                         |
| `pnpm test:unit` | Vitest: component tests (Chromium) and unit tests (Node)     |
| `pnpm test:e2e`  | Playwright against a production build, on mobile and desktop |
| `pnpm test`      | Unit tests, then e2e                                         |

## Project layout

```
src/routes/   pages and layouts
src/lib/      shared code, imported through $lib
e2e/          Playwright tests (*.e2e.ts)
```

Component tests sit next to the code as `*.svelte.spec.ts`; plain unit tests as `*.spec.ts`.

## TypeScript 7

TypeScript 7 no longer exposes the compiler API that `svelte-check` and `typescript-eslint` are built on. Both run side by side:

- `typescript` 6 is used by ESLint.
- `@typescript/native` (TypeScript 7) type-checks through `svelte-check --tsgo`.

Drop the TS 6 copy once both tools support TS 7 natively.

## Contributing

- One issue, one small PR, closing the issue.
- Conventional commits, one concern per commit.
- Every PR builds green and includes a short test plan.
- Test behaviour, not wording: each test should name the break it catches.
