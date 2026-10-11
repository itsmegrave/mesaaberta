# @mesaaberta/api

The api app of Trello #120: a Hono app that will own writes, policies and the outbox, one route at a
time, behind `api_<area>` GrowthBook flags (strangler; the web app stays the default path).

**Status: inert scaffold.** It answers `/healthz` and nothing else. It is not deployed, has no public
route, no cron and no bindings, and the web app does not call it. The web Worker will reach it
through a Service Binding, so there is no new DNS, CORS or auth surface.

## Moving a route (the rule)

1. Put the domain logic in `@mesaaberta/core` (runtime-neutral, no SvelteKit imports).
2. Add the Hono route here; keep the web form action as the default path.
3. Behind `api_<area>` (default off), the form action calls the api instead; admins first.
4. Roll back by turning the flag off.

Run `bun run --bun vitest run --project server apps/api`.
