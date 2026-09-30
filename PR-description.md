API reads currently rely on route refreshes and manual lookup state. This change introduces TanStack Svelte Query for SSR-seeded page reads, background focus/reconnect refreshes, shared caching, and invalidation after successful Superforms actions.

- Share authorized read services between server loads and an allowlisted same-origin API. Preserve Dates and isolate private data by viewer; hydrate only DTO fields.
- Migrate home/list/detail/dashboard/manage/catalog/account reads and username availability. Add authenticated, rate-limited CEP assistance using the existing ViaCEP/database cache, cancellation and manual-area fallback.
- Keep Superforms as the owner of writes, validation, uploads and progressive enhancement. Bridge successful actions to query invalidation and clear caches on identity changes.
- Document the inventory and explicit server-owned exceptions in `docs/api-queries.md`.

Trello: https://trello.com/c/g77W7kei
This ticket is independent of notification/version-banner work. Coordinate conflicts with table-edit PR #134.

Validation: `pnpm lint`, `pnpm check` (0 errors; 5 pre-existing warnings), `pnpm build`, and `pnpm test:unit --maxWorkers=2` (114 files / 1,283 tests) passed. Browser component tests ran with a local Chromium binary. `pnpm test:e2e` is blocked by the missing Docker/local Supabase stack; `pnpm test:integration` is blocked by the missing disposable Postgres/DATABASE_URL. Keep draft until these gates and the manual authenticated/no-JS flows are verified.
