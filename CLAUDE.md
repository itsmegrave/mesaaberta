# Project rules

Read [CONTRIBUTING.md](CONTRIBUTING.md) first: workflow, code style, translations and internal links all apply to agents too.

## UI and forms

- Prefer the project's existing Skeleton Svelte components and wrappers whenever they provide the control or interaction. Use TanStack Query for client-side server state, TanStack Table for interactive tables and TanStack Form for form state and validation. Superforms has been removed; use the shared actionForm contract for native POST and Query mutations.
- Use the shared Button, SubmitButton, TextInput, TextArea, SelectInput, FormField and Form components and the shared TanStack Form/Query integration. Reuse or extend existing wrappers before adding new ones. When Skeleton has no standalone primitive, keep the semantic HTML inside the shared wrapper instead of repeating control markup and styling across screens.
- Form migrations preserve SvelteKit actions, server authorization and validation, drafts and native POST where supported. Follow the UI/form contract in CONTRIBUTING.
- Keep semantic HTML for document structure and use native form elements when these libraries have no equivalent, progressive enhancement requires them, or a documented accessibility or CSP constraint requires them.
- Before adding a custom control, inspect the installed library components and existing project wrappers. Preserve keyboard behavior, labels, validation, focus states and responsive behavior.

## Spacing and visual consistency

- Use Tailwind's 4px spacing grid and the existing theme tokens for spacing, sizing, radius, borders and color. Avoid arbitrary values and one-off values; add a named token only when the design needs a value the existing scale cannot express.
- Calculated layout values and precise illustration geometry may use arbitrary values; leave a short comment explaining non-obvious cases.
- When changing a screen or component, review its mobile and desktop padding, gaps, border weight and color, radius and focus treatment against nearby UI.

## Pagination

- Paginated lists take the page number from `?page=N` (the first page has no parameter). A value that isn't a positive whole number reads as page 1, and a page past the last answers 404.

## Architecture migration (Trello #120)

The system is live at mesaaberta.app. The split into web / api / worker and the move to Bun is a strangler migration, not a rewrite. Decisions and ADRs live in the private `itsmegrave/mesaaberta-infra` repo (`docs/adr`), never here.

### Where things live

- `packages/db` (`@mesaaberta/db`): Drizzle schema and the postgres.js client. Migrations stay in `drizzle/`.
- `packages/contracts`: `DomainEvent` types and shared vocabulary.
- `packages/events`: the `EventBus` port, the Postgres outbox and poller, the transport contract (`JobTransport`/`JobExecutor`, ADR 0003).
- `packages/core` (`@mesaaberta/core`): the event-delivery graph (handlers, sweeper, scheduled, connectors, logger, privacy and Sentry options). Old paths under `src/lib` are re-export shims, so importers did not change.
- `apps/worker` (`@mesaaberta/worker`): the background Worker (cron today, Queues consumer later). **Not deployed and has no crons or routes**; the web Worker still owns both crons. Its README has the cutover and rollback.
- Ports (adapters with a no-op default): social (`SocialPublisher`), mail (`mailerFor`, `MAIL_PROVIDER=none`), analytics, flags (`createFlags` seam), telemetry (`TelemetrySink`; Sentry is the web and worker adapter).

### Rules for changes

- `packages/**` must stay runtime-neutral: no Node builtins, `Buffer`, `process` or `Bun.*` (ESLint enforces it; specs are exempt). Use `bytesToBase64` instead of `Buffer`.
- The delivery graph (`packages/core/src/server/events/{handlers,sweeper,scheduled}.ts`) must not import `@sveltejs/*`, `$app`, `$env`, paraglide or `@sentry/sveltekit`. `delivery-graph.spec.ts` fails if it does.
- When code moves into a package, leave a re-export shim at the old path and mock the new path in specs, not the shim.
- Strangler: each behavioral step ships behind a GrowthBook flag named `api_<area>`, default off. Behavior-preserving moves (extractions, shims) need no flag; rollback is a revert.
- Schema: expand, then migrate, then contract. Only additive migrations while old and new code run together. Never rename a handler (`handledBy` stores names) and never truncate or move `events` (audit and Marco Civil log).
- Anything under `/admin` may be on for all admins from the start; the flag is only a kill switch. Percentage ramps are for member-facing traffic. Pure UI fixes ship unflagged.
- There is no staging environment: canaries run on production (ADR 0003 addendum). Tell the user before creating or toggling a production flag, and before creating any Cloudflare resource (queues, Workers, KV). Do not flip the release flag `is_platform_released`.
- `EVENT_POLLER` stays off and `api_events_fenced_leases` stays at admins + 10% until the user says otherwise. `QUEUES_164_VERIFIED` is set only after evidence.
- Production deploys come from the private repo's pinned tagged release. Workers Builds stays connected until two verified pipeline deploys; do not run both at once (they would race on migrations).

### Tooling

- Bun workspaces (`apps/*`, `packages/*`). The pinned Bun is 1.4.2; an older local Bun writes a different lockfile, so use `bunx bun@1.4.2 install` to change `bun.lock` and `--frozen-lockfile` to validate it.
- Check with `bunx bun@1.4.2 run --bun svelte-check --tsgo --tsconfig ./tsconfig.json`, run unit tests with `bun run --bun vitest run --project server <path>`, and bundle a Worker with `wrangler deploy --dry-run`.
- Playwright e2e runs in CI only. The onboarding "without a single CSP violation" test is known to be flaky (the combobox positioner's inline style vs `style-src-attr`); rerun the failed shard and read its log before assuming a regression.
- Tests and CI never touch Cloudflare; they use Docker or simulated bindings.

### Workflow

- Link the Trello card in the PR body and post the PR link and an update on the card (#120: https://trello.com/c/3n967DND). Trello is the source of truth for what is open.
- Squash merge with `--admin` is authorized once CI is green. Delete the worktree and branch afterwards.
- Work in a `git worktree` off `origin/main`; the main checkout may hold unrelated uncommitted work.
